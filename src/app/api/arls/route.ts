import { NextRequest } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { broadcastUserUpdate } from "@/lib/socket-emit";
import { setPendingForceAction } from "@/lib/socket-server";
import { validate, createArlSchema, updateArlSchema } from "@/lib/validations";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { getTenant, canAddUser } from "@/lib/tenant";
import { logAudit } from "@/lib/audit-logger";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl" && session.userType !== "location") {
      return ApiErrors.forbidden();
    }
    const arls = db.select({
      id: schema.arls.id,
      name: schema.arls.name,
      email: schema.arls.email,
      userId: schema.arls.userId,
      role: schema.arls.role,
      roleId: schema.arls.roleId,
      permissions: schema.arls.permissions,
      assignedLocationIds: schema.arls.assignedLocationIds,
      isActive: schema.arls.isActive,
      createdAt: schema.arls.createdAt,
    }).from(schema.arls).where(eq(schema.arls.tenantId, session.tenantId)).all();
    return apiSuccess({ arls });
  } catch (error) {
    console.error("Get ARLs error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ARLS_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(createArlSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { name, email, userId, pin, role } = parsed.data;
    // Enforce tenant user limit
    const tenant = await getTenant();
    if (tenant && !canAddUser(session.tenantId, tenant.maxUsers)) {
      return ApiErrors.forbidden(`ARL user limit reached (${tenant.maxUsers} max for your plan)`);
    }

    const existing = db.select().from(schema.arls).where(and(eq(schema.arls.userId, userId), eq(schema.arls.tenantId, session.tenantId))).get();
    if (existing) return ApiErrors.badRequest("User ID already taken");

    const now = new Date().toISOString();
    const arl = { id: uuid(), tenantId: session.tenantId, name, email: email || null, userId, pinHash: hashSync(pin, 10), role: role || "arl", isActive: true, createdAt: now, updatedAt: now };
    db.insert(schema.arls).values(arl).run();
    broadcastUserUpdate(session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "create", entityType: "arl", payload: { targetId: arl.id, name, userId, role: role || "arl" }, status: "success" });
    return apiSuccess({ arl: { ...arl, pinHash: undefined } });
  } catch (error) {
    console.error("Create ARL error:", error);
    return ApiErrors.internal();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ARLS_EDIT);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(updateArlSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { id, name, email, pin, role, isActive, permissions: perms, roleId, assignedLocationIds } = parsed.data;

    // Only admins can change roles or permissions
    const callerArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId))).get();
    const isCallerAdmin = callerArl?.role === "admin";

    // Prevent non-admins from promoting/demoting or changing permissions/roles/location assignments
    if (!isCallerAdmin && (role !== undefined || perms !== undefined || roleId !== undefined || assignedLocationIds !== undefined)) {
      return ApiErrors.forbidden("Only admins can change roles or permissions");
    }

    // Prevent demoting/editing another admin unless caller is also admin
    const targetArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, id), eq(schema.arls.tenantId, session.tenantId))).get();
    if (targetArl?.role === "admin" && !isCallerAdmin) {
      return ApiErrors.forbidden("Only admins can edit other admins");
    }

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (pin && pin.length === 4) updates.pinHash = hashSync(pin, 10);
    if (role !== undefined && isCallerAdmin) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;
    if (perms !== undefined && isCallerAdmin) updates.permissions = perms === null ? null : JSON.stringify(perms);
    if (roleId !== undefined && isCallerAdmin) updates.roleId = roleId;
    if (assignedLocationIds !== undefined && isCallerAdmin) {
      updates.assignedLocationIds = assignedLocationIds === null ? null : JSON.stringify(assignedLocationIds);
    }

    db.update(schema.arls).set(updates).where(and(eq(schema.arls.id, id), eq(schema.arls.tenantId, session.tenantId))).run();
    broadcastUserUpdate(session.tenantId);

    // Force session refresh when privileges change so the user gets a fresh JWT
    const privilegeChanged = role !== undefined || perms !== undefined || roleId !== undefined
      || assignedLocationIds !== undefined || isActive === false;
    if (privilegeChanged && id !== session.id) {
      const targetSession = db.select({ token: schema.sessions.token })
        .from(schema.sessions)
        .where(and(eq(schema.sessions.userId, id), eq(schema.sessions.isOnline, true)))
        .get();
      if (targetSession?.token) {
        // If deactivated, force logout; otherwise force a redirect to refresh the JWT
        setPendingForceAction(targetSession.token, { action: isActive === false ? "logout" : "redirect", redirectTo: "/arl" });
      }
    }

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update ARL error:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ARLS_DELETE);
    if (denied) return denied;

    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("id required");

    // Prevent self-deletion
    if (id === session.id) {
      return ApiErrors.badRequest("Cannot delete yourself");
    }

    // Only admins can delete other admins
    const targetArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, id), eq(schema.arls.tenantId, session.tenantId))).get();
    const callerArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId))).get();
    if (targetArl?.role === "admin" && callerArl?.role !== "admin") {
      return ApiErrors.forbidden("Only admins can delete other admins");
    }

    // 1. Delete sessions
    db.delete(schema.sessions).where(eq(schema.sessions.userId, id)).run();

    // 2. Find and delete direct conversations (1:1) involving this ARL
    const directConvos = db.select().from(schema.conversations).all().filter(
      (c) => c.type === "direct" && (c.participantAId === id || c.participantBId === id)
    );
    for (const conv of directConvos) {
      const msgIds = db.select({ id: schema.messages.id }).from(schema.messages)
        .where(eq(schema.messages.conversationId, conv.id)).all().map((m) => m.id);
      for (const msgId of msgIds) {
        db.delete(schema.messageReads).where(eq(schema.messageReads.messageId, msgId)).run();
      }
      db.delete(schema.messages).where(eq(schema.messages.conversationId, conv.id)).run();
      db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.conversationId, conv.id)).run();
      db.delete(schema.conversations).where(eq(schema.conversations.id, conv.id)).run();
    }

    // 3. Delete this ARL's messages in group/global conversations
    const userMsgs = db.select({ id: schema.messages.id }).from(schema.messages)
      .where(eq(schema.messages.senderId, id)).all();
    for (const msg of userMsgs) {
      db.delete(schema.messageReads).where(eq(schema.messageReads.messageId, msg.id)).run();
    }
    db.delete(schema.messages).where(eq(schema.messages.senderId, id)).run();

    // 4. Delete read receipts by this ARL
    db.delete(schema.messageReads).where(eq(schema.messageReads.readerId, id)).run();

    // 5. Remove from remaining group conversation memberships
    db.delete(schema.conversationMembers).where(eq(schema.conversationMembers.memberId, id)).run();

    // 6. Delete push notification subscriptions
    db.delete(schema.pushSubscriptions).where(eq(schema.pushSubscriptions.userId, id)).run();

    // 7. Delete the ARL record
    const targetName = targetArl ? db.select({ name: schema.arls.name }).from(schema.arls).where(and(eq(schema.arls.id, id), eq(schema.arls.tenantId, session.tenantId))).get()?.name : "unknown";
    db.delete(schema.arls).where(eq(schema.arls.id, id)).run();
    broadcastUserUpdate(session.tenantId);
    logAudit({ tenantId: session.tenantId, userId: session.id, userType: "arl", operation: "delete", entityType: "arl", payload: { targetId: id, targetName }, status: "success" });
    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Delete ARL error:", error);
    return ApiErrors.internal();
  }
}
