import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { db, sqlite, schema } from "@/lib/db";
import { eq, and, desc } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { sendPushToARL } from "@/lib/push";
import { broadcastNewMessage, broadcastConversationUpdate, broadcastMessageRead } from "@/lib/socket-emit";
import { validate, sendMessageSchema } from "@/lib/validations";

/**
 * Batch unread counts for multiple conversations in a single query.
 * Returns Map<conversationId, unreadCount>
 */
function getUnreadCountsBatch(convIds: string[], sessionId: string, sessionType: string): Map<string, number> {
  const result = new Map<string, number>();
  if (convIds.length === 0) return result;

  const placeholders = convIds.map(() => "?").join(",");
  const rows = sqlite.prepare(`
    SELECT m.conversation_id, COUNT(*) as cnt
    FROM messages m
    LEFT JOIN message_reads mr ON mr.message_id = m.id AND mr.reader_id = ? AND mr.reader_type = ?
    WHERE m.conversation_id IN (${placeholders})
      AND m.sender_id != ?
      AND mr.id IS NULL
    GROUP BY m.conversation_id
  `).all(sessionId, sessionType, ...convIds, sessionId) as Array<{ conversation_id: string; cnt: number }>;

  for (const row of rows) {
    result.set(row.conversation_id, row.cnt);
  }
  return result;
}

/**
 * Batch last messages for multiple conversations in a single query.
 * Returns Map<conversationId, lastMessage>
 */
function getLastMessagesBatch(convIds: string[]): Map<string, { content: string; createdAt: string; senderType: string; senderName: string }> {
  const result = new Map();
  if (convIds.length === 0) return result;

  const placeholders = convIds.map(() => "?").join(",");
  const rows = sqlite.prepare(`
    SELECT m.conversation_id, m.content, m.created_at, m.sender_type, m.sender_name
    FROM messages m
    INNER JOIN (
      SELECT conversation_id, MAX(created_at) as max_at
      FROM messages
      WHERE conversation_id IN (${placeholders})
      GROUP BY conversation_id
    ) latest ON m.conversation_id = latest.conversation_id AND m.created_at = latest.max_at
  `).all(...convIds) as Array<{ conversation_id: string; content: string; created_at: string; sender_type: string; sender_name: string }>;

  for (const row of rows) {
    result.set(row.conversation_id, {
      content: row.content,
      createdAt: row.created_at,
      senderType: row.sender_type,
      senderName: row.sender_name,
    });
  }
  return result;
}

/**
 * Batch member counts + members for multiple conversations.
 */
function getMembersBatch(convIds: string[]): Map<string, Array<{ memberId: string; memberType: string }>> {
  const result = new Map<string, Array<{ memberId: string; memberType: string }>>();
  if (convIds.length === 0) return result;

  const placeholders = convIds.map(() => "?").join(",");
  const rows = sqlite.prepare(`
    SELECT conversation_id, member_id, member_type
    FROM conversation_members
    WHERE conversation_id IN (${placeholders})
  `).all(...convIds) as Array<{ conversation_id: string; member_id: string; member_type: string }>;

  for (const row of rows) {
    if (!result.has(row.conversation_id)) result.set(row.conversation_id, []);
    result.get(row.conversation_id)!.push({ memberId: row.member_id, memberType: row.member_type });
  }
  return result;
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
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const conversationId = searchParams.get("conversationId");

    if (!conversationId) {
      // Return all conversations this user is a member of
      const memberships = db.select().from(schema.conversationMembers)
        .where(and(eq(schema.conversationMembers.memberId, session.id), eq(schema.conversationMembers.memberType, session.userType)))
        .all();
      const convIds = memberships.map((m) => m.conversationId);

      if (convIds.length === 0) {
        return apiSuccess({ conversations: [] });
      }

      const allConvs = db.select().from(schema.conversations).all()
        .filter((c) => convIds.includes(c.id))
        .filter((c) => {
          const deletedBy: string[] = JSON.parse(c.deletedBy || "[]");
          return !deletedBy.includes(session.id);
        });

      const filteredIds = allConvs.map((c) => c.id);

      // Batch lookups — 3 queries instead of 3×N
      const [unreadCounts, lastMessages, membersMap] = [
        getUnreadCountsBatch(filteredIds, session.id, session.userType),
        getLastMessagesBatch(filteredIds),
        getMembersBatch(filteredIds),
      ];

      const locations = db.select().from(schema.locations).where(eq(schema.locations.tenantId, session.tenantId)).all();
      const arls = db.select().from(schema.arls).where(eq(schema.arls.tenantId, session.tenantId)).all();
      const locationMap = new Map(locations.map((l) => [l.id, { name: l.name, storeNumber: l.storeNumber }]));
      const arlMap = new Map(arls.map((a) => [a.id, { name: a.name }]));

      const convosWithDetails = allConvs
        .sort((a, b) => (b.lastMessageAt || b.createdAt).localeCompare(a.lastMessageAt || a.createdAt))
        .map((conv) => {
          const { name, subtitle } = getConvDisplayName(conv, session.id, locationMap, arlMap);
          const lastMessage = lastMessages.get(conv.id) || null;
          const unreadCount = unreadCounts.get(conv.id) || 0;
          const members = membersMap.get(conv.id) || [];
          return {
            id: conv.id,
            type: conv.type,
            name,
            subtitle,
            lastMessage,
            unreadCount,
            memberCount: members.length,
            members,
          };
        });

      return apiSuccess({ conversations: convosWithDetails });
    }

    // Verify membership
    const membership = db.select().from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.memberId, session.id)))
      .get();
    if (!membership) return ApiErrors.forbidden("Not a member");

    const messages = db.select().from(schema.messages)
      .where(eq(schema.messages.conversationId, conversationId))
      .orderBy(schema.messages.createdAt).all();

    const messageIds = messages.map((m) => m.id);

    // Fetch reads only for this conversation's messages (scoped query, not full table)
    const readMap = new Map<string, Array<{ readerType: string; readerId: string; readAt: string }>>();
    if (messageIds.length > 0) {
      const ph = messageIds.map(() => "?").join(",");
      const reads = sqlite.prepare(`
        SELECT id, message_id, reader_type, reader_id, read_at
        FROM message_reads
        WHERE message_id IN (${ph})
      `).all(...messageIds) as Array<{ id: string; message_id: string; reader_type: string; reader_id: string; read_at: string }>;
      for (const read of reads) {
        if (!readMap.has(read.message_id)) readMap.set(read.message_id, []);
        readMap.get(read.message_id)!.push({ readerType: read.reader_type, readerId: read.reader_id, readAt: read.read_at });
      }
    }

    // Auto-mark all messages from OTHER users as read for the current user.
    // Viewing a conversation = reading its messages.
    const myReadIdsFinal = new Set<string>();
    for (const [msgId, readers] of readMap) {
      if (readers.some((r) => r.readerId === session.id)) myReadIdsFinal.add(msgId);
    }
    const now = new Date().toISOString();
    let markedAny = false;
    for (const msg of messages) {
      if (msg.senderId !== session.id && !myReadIdsFinal.has(msg.id)) {
        db.insert(schema.messageReads).values({
          id: uuid(),
          messageId: msg.id,
          readerType: session.userType,
          readerId: session.id,
          readAt: now,
        }).run();
        // Also add to readMap so the response reflects the new read
        if (!readMap.has(msg.id)) readMap.set(msg.id, []);
        readMap.get(msg.id)!.push({ readerType: session.userType, readerId: session.id, readAt: now });
        markedAny = true;
      }
    }
    if (markedAny) {
      broadcastMessageRead(conversationId, session.id);
      broadcastConversationUpdate(conversationId);
    }

    // Build reactions map — scoped to this conversation's messages
    let reactionMap = new Map<string, Array<{ emoji: string; userId: string; userName: string; createdAt: string }>>();
    try {
      if (messageIds.length > 0) {
        const ph = messageIds.map(() => "?").join(",");
        const reactions = sqlite.prepare(`
          SELECT message_id, emoji, user_id, user_name, created_at
          FROM message_reactions
          WHERE message_id IN (${ph})
        `).all(...messageIds) as Array<{ message_id: string; emoji: string; user_id: string; user_name: string; created_at: string }>;
        for (const r of reactions) {
          if (!reactionMap.has(r.message_id)) reactionMap.set(r.message_id, []);
          reactionMap.get(r.message_id)!.push({ emoji: r.emoji, userId: r.user_id, userName: r.user_name, createdAt: r.created_at });
        }
      }
    } catch (reactionError) {
      console.error("Failed to load reactions (table may not exist):", reactionError);
    }

    return apiSuccess({ messages: messages.map((m) => ({ ...m, reads: readMap.get(m.id) || [], reactions: reactionMap.get(m.id) || [] })) });
  } catch (error) {
    console.error("Get messages error:", error);
    return ApiErrors.internal();
  }
}

// POST send a message
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const body = await req.json();
    const parsed = validate(sendMessageSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { conversationId, content } = parsed.data;

    // Verify membership
    const membership = db.select().from(schema.conversationMembers)
      .where(and(eq(schema.conversationMembers.conversationId, conversationId), eq(schema.conversationMembers.memberId, session.id)))
      .get();
    if (!membership) return ApiErrors.forbidden("Not a member");

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

    // Un-hide the conversation for any member who had soft-deleted it
    // (a new incoming message should resurface the thread for them)
    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId)).get();
    if (conv) {
      const deletedBy: string[] = JSON.parse(conv.deletedBy || "[]");
      // Remove everyone except the sender — their own hide stays intact
      const updatedDeletedBy = deletedBy.filter((id) => id === session.id);
      if (updatedDeletedBy.length !== deletedBy.length) {
        db.update(schema.conversations)
          .set({ deletedBy: JSON.stringify(updatedDeletedBy) })
          .where(eq(schema.conversations.id, conversationId)).run();
      }
    }

    db.update(schema.conversations)
      .set({ lastMessageAt: now, lastMessagePreview: content.slice(0, 80) })
      .where(eq(schema.conversations.id, conversationId)).run();

    // Send push notifications to relevant participants
    if (conv) {
      const members = db.select().from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, conversationId)).all();
      // Notify ARL members who are not the sender
      const arlMemberIds = members
        .filter((m) => m.memberType === "arl" && m.memberId !== session.id)
        .map((m) => m.memberId);

      if (conv.type === "direct") {
        // Direct: notify the other participant if ARL
        const otherId = conv.participantAId === session.id ? conv.participantBId : conv.participantAId;
        const otherType = conv.participantAId === session.id ? conv.participantBType : conv.participantAType;
        if (otherId && otherType === "arl") {
          await sendPushToARL(otherId, {
            title: `New message from ${session.name}`,
            body: content.slice(0, 120),
            url: `/arl?tab=messaging&conversation=${conversationId}`,
            conversationId,
          });
        }
      } else if (conv.type === "global") {
        // Global: notify all active ARLs except sender
        const allArls = db.select().from(schema.arls).where(and(eq(schema.arls.isActive, true), eq(schema.arls.tenantId, session.tenantId))).all();
        for (const arl of allArls) {
          if (arl.id !== session.id) {
            await sendPushToARL(arl.id, {
              title: `Global Chat: ${session.name}`,
              body: content.slice(0, 120),
              url: `/arl?tab=messaging&conversation=${conversationId}`,
              conversationId,
            });
          }
        }
      } else if (conv.type === "group") {
        // Group: notify all ARL members except sender
        for (const arlId of arlMemberIds) {
          await sendPushToARL(arlId, {
            title: `${conv.name || "Group"}: ${session.name}`,
            body: content.slice(0, 120),
            url: `/arl?tab=messaging&conversation=${conversationId}`,
            conversationId,
          });
        }
      }
    }

    // Broadcast via WebSocket FIRST for instant delivery
    broadcastNewMessage(conversationId, message);
    broadcastConversationUpdate(conversationId);

    return apiSuccess({ message });
  } catch (error) {
    console.error("Send message error:", error);
    return ApiErrors.internal();
  }
}

// POST /api/messages/conversations - create a group or direct conversation
export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { type, name, memberIds, memberTypes } = await req.json();

    if (!type || !memberIds || !Array.isArray(memberIds)) {
      return ApiErrors.badRequest("type and memberIds required");
    }

    const now = new Date().toISOString();
    const convId = uuid();

    if (type === "direct") {
      const [otherId, otherType] = [memberIds[0], memberTypes[0]];
      // Check if direct conv already exists between these two
      const existing = db.select().from(schema.conversations).all().find(
        (c) => c.type === "direct" && (
          (c.participantAId === session.id && c.participantBId === otherId) ||
          (c.participantAId === otherId && c.participantBId === session.id)
        )
      );
      
      if (existing) {
        // If user had deleted this conversation, resurrect it by removing them from deletedBy
        const deletedBy: string[] = JSON.parse(existing.deletedBy || "[]");
        if (deletedBy.includes(session.id)) {
          const updatedDeletedBy = deletedBy.filter((id) => id !== session.id);
          db.update(schema.conversations)
            .set({ deletedBy: JSON.stringify(updatedDeletedBy) })
            .where(eq(schema.conversations.id, existing.id))
            .run();
        }
        return apiSuccess({ conversation: existing });
      }

      db.insert(schema.conversations).values({
        id: convId, tenantId: session.tenantId, type: "direct",
        participantAId: session.id, participantAType: session.userType,
        participantBId: otherId, participantBType: otherType,
        createdAt: now,
      }).run();
      db.insert(schema.conversationMembers).values([
        { id: uuid(), conversationId: convId, memberId: session.id, memberType: session.userType, joinedAt: now },
        { id: uuid(), conversationId: convId, memberId: otherId, memberType: otherType, joinedAt: now },
      ]).run();
    } else if (type === "group") {
      if (!name) return ApiErrors.badRequest("Group name required");
      db.insert(schema.conversations).values({
        id: convId, tenantId: session.tenantId, type: "group", name, createdBy: session.id, createdByType: session.userType, createdAt: now,
      }).run();
      // Add creator + all specified members
      // Creator is always admin (location or ARL)
      // All ARLs are admins
      // Locations are members (unless they're the creator)
      const allMembers = [{ id: session.id, type: session.userType }, ...memberIds.map((id: string, i: number) => ({ id, type: memberTypes[i] }))];
      const unique = allMembers.filter((m, i, arr) => arr.findIndex((x) => x.id === m.id) === i);
      db.insert(schema.conversationMembers).values(
        unique.map((m) => ({ 
          id: uuid(), 
          conversationId: convId, 
          memberId: m.id, 
          memberType: m.type, 
          // Creator is always admin, all ARLs are admins, other locations are members
          role: (m.id === session.id || m.type === "arl") ? "admin" : "member",
          joinedAt: now 
        }))
      ).run();
    }

    const conv = db.select().from(schema.conversations).where(eq(schema.conversations.id, convId)).get();
    return apiSuccess({ conversation: conv });
  } catch (error) {
    console.error("Create conversation error:", error);
    return ApiErrors.internal();
  }
}
