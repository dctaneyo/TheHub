import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastEmergency, broadcastEmergencyDismissed, broadcastEmergencyViewed, broadcastEmergencyViewedLocal } from "@/lib/socket-emit";
import { createNotificationBulk } from "@/lib/notifications";
import { validate, emergencyBroadcastSchema } from "@/lib/validations";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { logAudit } from "@/lib/audit-logger";

// GET active emergency message (any authenticated user)
// For locations: only returns message if they are a target (or message targets all)
// For ARLs: also returns history of past messages
export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const all = db.select().from(schema.emergencyMessages)
      .where(eq(schema.emergencyMessages.tenantId, session.tenantId))
      .orderBy(schema.emergencyMessages.createdAt).all();

    const active = all.filter((m) => m.isActive)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0] || null;

    if (session.userType === "arl") {
      // ARLs get the active message + full history
      const history = all
        .filter((m) => !m.isActive)
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
        .map((m) => ({
          ...m,
          viewedBy: m.viewedBy ? JSON.parse(m.viewedBy) : [],
          targetLocationIds: m.targetLocationIds ? JSON.parse(m.targetLocationIds) : null,
        }));
      return NextResponse.json({
        message: active ? {
          ...active,
          viewedBy: active.viewedBy ? JSON.parse(active.viewedBy) : [],
          targetLocationIds: active.targetLocationIds ? JSON.parse(active.targetLocationIds) : null,
        } : null,
        history,
      });
    }

    // Location: filter by target and already-viewed
    if (!active) return NextResponse.json({ message: null });

    const targets: string[] | null = active.targetLocationIds
      ? JSON.parse(active.targetLocationIds)
      : null;
    if (targets && !targets.includes(session.id)) {
      return NextResponse.json({ message: null });
    }
    const viewedByCheck: string[] = active.viewedBy ? JSON.parse(active.viewedBy) : [];
    if (viewedByCheck.includes(session.id)) {
      return NextResponse.json({ message: null });
    }

    return NextResponse.json({
      message: {
        ...active,
        viewedBy: viewedByCheck,
        targetLocationIds: targets,
      }
    });
  } catch (error) {
    console.error("Get emergency error:", error);
    return NextResponse.json({ message: null });
  }
}

// POST send emergency message (ARL only)
// Body: { message, targetLocationIds?: string[] | null }  (null = all)
export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`emergency:${ip}`, { maxAttempts: 5, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL only");
    }
    const denied = await requirePermission(session, PERMISSIONS.EMERGENCY_ACCESS);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(emergencyBroadcastSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { message, targetLocationIds } = parsed.data;
    if (!message?.trim()) return ApiErrors.badRequest("Message required");

    // Deactivate all previous messages for this tenant
    db.update(schema.emergencyMessages)
      .set({ isActive: false })
      .where(and(eq(schema.emergencyMessages.isActive, true), eq(schema.emergencyMessages.tenantId, session.tenantId))).run();

    const now = new Date().toISOString();
    const id = uuid();
    db.insert(schema.emergencyMessages).values({
      id,
      tenantId: session.tenantId,
      message: message.trim(),
      sentBy: session.id,
      sentByName: session.name,
      isActive: true,
      targetLocationIds: targetLocationIds && targetLocationIds.length > 0
        ? JSON.stringify(targetLocationIds)
        : null,
      viewedBy: "[]",
      createdAt: now,
    }).run();

    // Broadcast instantly via WebSocket
    broadcastEmergency({
      id,
      message: message.trim(),
      sentByName: session.name,
      targetLocationIds: targetLocationIds && targetLocationIds.length > 0 ? targetLocationIds : null,
    }, session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "send", entityType: "emergency_broadcast", payload: { broadcastId: id, targetCount: targetLocationIds?.length || "all" }, status: "success" });

    // Create urgent notifications for all targeted locations
    const targetIds = targetLocationIds && targetLocationIds.length > 0 
      ? targetLocationIds 
      : db.select().from(schema.locations).where(and(eq(schema.locations.isActive, true), eq(schema.locations.tenantId, session.tenantId))).all().map(l => l.id);
    
    await createNotificationBulk(
      targetIds,
      {
        userType: "location",
        type: "emergency_broadcast",
        title: "🚨 Emergency Alert",
        message: message.trim(),
        actionUrl: "/dashboard",
        actionLabel: "View",
        priority: "urgent",
        metadata: {
          broadcastId: id,
          sentBy: session.id,
          sentByName: session.name,
        },
      }
    );

    return apiSuccess({ id });
  } catch (error) {
    console.error("Send emergency error:", error);
    return ApiErrors.internal();
  }
}

// PATCH mark message as viewed by current location
// Auto-archives when all targeted recipients have viewed it
export async function PATCH(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return ApiErrors.forbidden("Location only");
    }

    const { messageId } = await req.json();
    if (!messageId) return ApiErrors.badRequest("messageId required");

    const msg = db.select().from(schema.emergencyMessages)
      .where(eq(schema.emergencyMessages.id, messageId)).get();
    if (!msg) return ApiErrors.notFound("Emergency message");

    const viewedBy: string[] = msg.viewedBy ? JSON.parse(msg.viewedBy) : [];
    if (!viewedBy.includes(session.id)) {
      viewedBy.push(session.id);
    }

    // Determine if all targets have now viewed it
    const targets: string[] | null = msg.targetLocationIds
      ? JSON.parse(msg.targetLocationIds)
      : null;

    let shouldArchive = false;
    if (targets) {
      // Targeted broadcast: archive when all targeted locations have viewed
      shouldArchive = targets.every((id) => viewedBy.includes(id));
    } else {
      // All-locations broadcast: we can't know total count here, so just track views
      // ARLs can manually clear; auto-archive only for targeted broadcasts
      shouldArchive = false;
    }

    db.update(schema.emergencyMessages)
      .set({ viewedBy: JSON.stringify(viewedBy), isActive: shouldArchive ? false : msg.isActive })
      .where(eq(schema.emergencyMessages.id, messageId)).run();

    // Notify ARLs in real-time that this location viewed the message
    broadcastEmergencyViewed(messageId, session.id, session.name, session.tenantId);
    // Notify sibling kiosks at this location so they also dismiss the overlay
    broadcastEmergencyViewedLocal(session.id, messageId, session.tenantId);

    return apiSuccess({ archived: shouldArchive });
  } catch (error) {
    console.error("Mark viewed error:", error);
    return ApiErrors.internal();
  }
}

// DELETE clear emergency message (ARL only)
export async function DELETE() {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL only");
    }
    const denied = await requirePermission(session, PERMISSIONS.EMERGENCY_ACCESS);
    if (denied) return denied;

    db.update(schema.emergencyMessages)
      .set({ isActive: false })
      .where(eq(schema.emergencyMessages.isActive, true)).run();

    broadcastEmergencyDismissed(session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "clear", entityType: "emergency_broadcast", status: "success" });

    return apiSuccess({ cleared: true });
  } catch (error) {
    console.error("Clear emergency error:", error);
    return ApiErrors.internal();
  }
}
