import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { sendPushToARL } from "@/lib/push";
import { broadcastNewMessage, broadcastConversationUpdate } from "@/lib/socket-emit";

// Helper: get unread count for a conversation for the current session user
function getUnreadCount(conversationId: string, sessionId: string, sessionType: string): number {
  const allMsgs = db.select().from(schema.messages)
    .where(eq(schema.messages.conversationId, conversationId)).all();
  const readIds = new Set(
    db.select().from(schema.messageReads)
      .where(and(eq(schema.messageReads.readerId, sessionId), eq(schema.messageReads.readerType, sessionType)))
      .all().map((r) => r.messageId)
  );
  return allMsgs.filter((m) => m.senderId !== sessionId && !readIds.has(m.id)).length;
}

// Helper: get display name for a conversation from the perspective of the current user
function getConvDisplayName(
  conv: { type: string; name: string | null; participantAId: string | null; participantAType: string | null; participantBId: string | null; participantBType: string | null },
  sessionId: string,
  locationMap: Map<string, { name: string; storeNumber: string }>,
  arlMap: Map<string, { name: string }>
): { name: string; subtitle: string } {
  if (conv.type === "global") return { name: "Global Chat", subtitle: "All locations & ARLs" };
  if (conv.type === "group") return { name: conv.name || "Group", subtitle: "Group chat" };
  // direct - show the other participant
  const otherId = conv.participantAId === sessionId ? conv.participantBId : conv.participantAId;
  const otherType = conv.participantAId === sessionId ? conv.participantBType : conv.participantAType;
  if (otherType === "location" && otherId) {
    const loc = locationMap.get(otherId);
    return { name: loc?.name || "Location", subtitle: `Store #${loc?.storeNumber || ""}` };
  }
  if (otherType === "arl" && otherId) {
    const arl = arlMap.get(otherId);
    return { name: arl?.name || "ARL", subtitle: "ARL" };
  }
  return { name: "Chat", subtitle: "" };
}

// GET conversations list or messages for a specific conversation
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      // Return all conversations this user is a member of
      const memberships = db.select().from(schema.conversationMembers)
        .where(and(eq(schema.conversationMembers.memberId, session.id), eq(schema.conversationMembers.memberType, session.userType)))
        .all();
      const convIds = memberships.map((m) => m.conversationId);

      const allConvs = db.select().from(schema.conversations).all()
        .filter((c) => convIds.includes(c.id))
        .filter((c) => {
          const deletedBy: string[] = JSON.parse(c.deletedBy || "[]");
          return !deletedBy.includes(session.id);
        });

      const locations = db.select().from(schema.locations).all();
      const arls = db.select().from(schema.arls).all();
      const locationMap = new Map(locations.map((l) => [l.id, { name: l.name, storeNumber: l.storeNumber }]));
      const arlMap = new Map(arls.map((a) => [a.id, { name: a.name }]));

      const convosWithDetails = allConvs
        .sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt))
        .map((conv) => {
          const { name, subtitle } = getConvDisplayName(conv, session.id, locationMap, arlMap);
          const lastMessage = db.select().from(schema.messages)
            .where(eq(schema.messages.conversationId, conv.id))
            .orderBy(desc(schema.messages.createdAt)).limit(1).get();
          const unreadCount = getUnreadCount(conv.id, session.id, session.userType);
          const members = db.select().from(schema.conversationMembers)
            .where(eq(schema.conversationMembers.conversationId, conv.id)).all();
          return {
            id: conv.id,
            type: conv.type,
            name,
            subtitle,
            lastMessage: lastMessage ? { content: lastMessage.content, createdAt: lastMessage.createdAt, senderType: lastMessage.senderType, senderName: lastMessage.senderName } : null,
            unreadCount,
            memberCount: members.length,
            members: members.map((m) => ({ memberId: m.memberId, memberType: m.memberType })),
          };
        });

      return NextResponse.json({ conversations: convosWithDetails });
    }

    // Verify membership
    const membership = db.select().from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.memberId, session.id)))
      .get();
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const messages = db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt).all();

    const messageIds = messages.map((m) => m.id);
    const reads = db.select().from(schema.messageReads).all();
    const readMap = new Map<string, Array<{ readerType: string; readerId: string; readAt: string }>>();
    for (const read of reads) {
      if (messageIds.includes(read.messageId)) {
        if (!readMap.has(read.messageId)) readMap.set(read.messageId, []);
        readMap.get(read.messageId)!.push({ readerType: read.readerType, readerId: read.readerId, readAt: read.readAt });
      }
    }

    return NextResponse.json({ messages: messages.map((m) => ({ ...m, reads: readMap.get(m.id) || [] })) });
  } catch (error) {
    console.error("Get messages error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST send a message
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { conversationId, content } = await req.json();
    if (!conversationId || !content) return NextResponse.json({ error: "conversationId and content required" }, { status: 400 });

    // Verify membership
    const membership = db.select().from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.memberId, session.id)))
      .get();
    if (!membership) return NextResponse.json({ error: "Not a member" }, { status: 403 });

    const now = new Date().toISOString();
    const message = {
      id: uuid(),
      conversationId,
      senderType: session.userType,
      senderId: session.id,
      senderName: session.name,
      content,
      messageType: "text" as const,
      createdAt: now,
    };

    db.insert(schema.messages).values(message).run();
    db.update(schema.conversations)
      .set({ lastMessageAt: now, lastMessagePreview: content.slice(0, 80) })
      .where(eq(schema.conversations.id, conversationId)).run();

    // Send push notification to ARLs if this is from a location
    if (session.userType === "location") {
      // Get conversation details to find ARL participants
      const conv = db.select().from(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .get();
      
      if (conv) {
        // For direct messages, notify the other participant
        if (conv.type === "direct") {
          const arlId = conv.participantAId === session.id ? conv.participantBId : conv.participantAId;
          if (arlId) {
            await sendPushToARL(arlId, {
              title: `New message from ${session.name}`,
              body: content,
              url: `/arl?tab=messaging&conversation=${conversationId}`,
              conversationId,
            });
          }
        } else if (conv.type === "global") {
          // For global chat, notify all ARLs
          const arls = db.select().from(schema.arls)
            .where(eq(schema.arls.isActive, true))
            .all();
          
          for (const arl of arls) {
            await sendPushToARL(arl.id, {
              title: `Global Chat: ${session.name}`,
              body: content,
              url: `/arl?tab=messaging&conversation=${conversationId}`,
              conversationId,
            });
          }
        }
      }
    }

    // Broadcast via WebSocket for instant delivery
    broadcastNewMessage(conversationId, message);
    broadcastConversationUpdate(conversationId);

    return NextResponse.json({ success: true, message });
  } catch (error) {
    console.error("Send message error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST /api/messages/conversations - create a group or direct conversation
export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { type, name, memberIds, memberTypes } = await req.json();
    // type: 'group' | 'direct'
    // memberIds: array of participant IDs (including self)
    // memberTypes: array matching memberIds

    if (!type || !memberIds || !Array.isArray(memberIds)) {
      return NextResponse.json({ error: "type and memberIds required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const convId = uuid();

    if (type === "direct") {
      const [otherId, otherType] = [memberIds[0], memberTypes[0]];
      // Check if direct conv already exists between these two (that neither has deleted)
      const existing = db.select().from(schema.conversations).all().find(
        (c) => c.type === "direct" && (
          (c.participantAId === session.id && c.participantBId === otherId) ||
          (c.participantAId === otherId && c.participantBId === session.id)
        ) && !JSON.parse(c.deletedBy || "[]").includes(session.id)
      );
      if (existing) return NextResponse.json({ conversation: existing });

      db.insert(schema.conversations).values({
        id: convId, type: "direct",
        participantAId: session.id, participantAType: session.userType,
        participantBId: otherId, participantBType: otherType,
        createdAt: now,
      }).run();
      db.insert(schema.conversationMembers).values([
        { id: uuid(), conversationId: convId, memberId: session.id, memberType: session.userType, joinedAt: now },
        { id: uuid(), conversationId: convId, memberId: otherId, memberType: otherType, joinedAt: now },
      ]).run();
    } else if (type === "group") {
      if (!name) return NextResponse.json({ error: "Group name required" }, { status: 400 });
      db.insert(schema.conversations).values({
        id: convId, type: "group", name, createdBy: session.id, createdAt: now,
      }).run();
      // Add creator + all specified members
      const allMembers = [{ id: session.id, type: session.userType }, ...memberIds.map((id: string, i: number) => ({ id, type: memberTypes[i] }))];
      const unique = allMembers.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
      db.insert(schema.conversationMembers).values(
        unique.map((m) => ({ id: uuid(), conversationId: convId, memberId: m.id, memberType: m.type, joinedAt: now }))
      ).run();
    }

    const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
    return NextResponse.json({ success: true, conversation: conv });
  } catch (error) {
    console.error("Create conversation error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
