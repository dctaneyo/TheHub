import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import { broadcastUserUpdate } from "@/lib/socket-emit";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl" && session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const arls = db.select({
      id: schema.arls.id,
      name: schema.arls.name,
      email: schema.arls.email,
      userId: schema.arls.userId,
      role: schema.arls.role,
      isActive: schema.arls.isActive,
      createdAt: schema.arls.createdAt,
    }).from(schema.arls).where(eq(schema.arls.tenantId, session.tenantId)).all();
    return NextResponse.json({ arls });
  } catch (error) {
    console.error("Get ARLs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const { name, email, userId, pin, role } = await req.json();
    if (!name || !userId || !pin || userId.length !== 4 || pin.length !== 4) {
      return NextResponse.json({ error: "name, 4-digit userId, and 4-digit pin required" }, { status: 400 });
    }
    const existing = db.select().from(schema.arls).where(and(eq(schema.arls.userId, userId), eq(schema.arls.tenantId, session.tenantId))).get();
    if (existing) return NextResponse.json({ error: "User ID already taken" }, { status: 409 });

    const now = new Date().toISOString();
    const arl = { id: uuid(), tenantId: session.tenantId, name, email: email || null, userId, pinHash: hashSync(pin, 10), role: role || "arl", isActive: true, createdAt: now, updatedAt: now };
    db.insert(schema.arls).values(arl).run();
    broadcastUserUpdate();
    return NextResponse.json({ success: true, arl: { ...arl, pinHash: undefined } });
  } catch (error) {
    console.error("Create ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const { id, name, email, pin, role, isActive } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (pin && pin.length === 4) updates.pinHash = hashSync(pin, 10);
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.arls).set(updates).where(and(eq(schema.arls.id, id), eq(schema.arls.tenantId, session.tenantId))).run();
    broadcastUserUpdate();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Prevent self-deletion
    if (id === session.id) {
      return NextResponse.json({ error: "Cannot delete yourself" }, { status: 400 });
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
    db.delete(schema.arls).where(eq(schema.arls.id, id)).run();
    broadcastUserUpdate();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
