import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, getTenantIdFromHeaders, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and, desc, or, isNull, gte } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { emitTickerMessage, emitTickerDelete } from "@/lib/socket-emit";

// GET - fetch active ticker messages
export async function GET() {
  try {
    const tenantId = await getTenantIdFromHeaders();
    if (!tenantId) return ApiErrors.badRequest("Organization context required");
    const now = new Date().toISOString();
    const messages = db
      .select()
      .from(schema.tickerMessages)
      .where(eq(schema.tickerMessages.tenantId, tenantId))
      .orderBy(desc(schema.tickerMessages.createdAt))
      .all()
      .filter((m) => !m.expiresAt || m.expiresAt > now);

    return apiSuccess({ messages });
  } catch (error) {
    console.error("Ticker GET error:", error);
    return ApiErrors.internal();
  }
}

// POST - create a new ticker message (ARL only)
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }
    const denied = await requirePermission(session, PERMISSIONS.TICKER_CREATE);
    if (denied) return denied;

    const { content, icon, expiresInMinutes } = await req.json();
    if (!content?.trim()) {
      return ApiErrors.badRequest("Content required");
    }

    const id = uuid();
    const now = new Date().toISOString();
    const expiresAt = expiresInMinutes
      ? new Date(Date.now() + expiresInMinutes * 60 * 1000).toISOString()
      : null;

    db.insert(schema.tickerMessages).values({
      id,
      tenantId: session.tenantId,
      content: content.trim(),
      icon: icon || "📢",
      arlId: session.userId,
      arlName: session.name,
      expiresAt,
      createdAt: now,
    }).run();

    const msg = { id, content: content.trim(), icon: icon || "📢", arlId: session.userId, arlName: session.name, expiresAt, createdAt: now };

    // Broadcast to all locations via socket
    emitTickerMessage(msg, session.tenantId);

    return apiSuccess({ message: msg });
  } catch (error) {
    console.error("Ticker POST error:", error);
    return ApiErrors.internal();
  }
}

// DELETE - remove a ticker message (ARL only)
export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }
    const denied = await requirePermission(session, PERMISSIONS.TICKER_DELETE);
    if (denied) return denied;

    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");

    db.delete(schema.tickerMessages).where(and(eq(schema.tickerMessages.id, id), eq(schema.tickerMessages.tenantId, session.tenantId))).run();

    emitTickerDelete(id, session.tenantId);

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Ticker DELETE error:", error);
    return ApiErrors.internal();
  }
}
