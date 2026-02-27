import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema, sqlite } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { broadcastNewMessage, broadcastConversationUpdate } from "@/lib/socket-emit";
import { createNotification } from "@/lib/notifications";
import { sendPushToARL } from "@/lib/push";

const VOICE_DIR = path.join(process.cwd(), "data", "voice-messages");

// Ensure voice messages directory exists
async function ensureVoiceDir() {
  if (!existsSync(VOICE_DIR)) {
    await mkdir(VOICE_DIR, { recursive: true });
  }
}

// POST - Upload a voice message
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const audioFile = formData.get("audio") as File;
    const conversationId = formData.get("conversationId") as string;
    const durationMs = parseInt(formData.get("duration") as string || "0");

    if (!audioFile || !conversationId) {
      return NextResponse.json({ error: "Missing audio or conversationId" }, { status: 400 });
    }

    // Validate file size (max 5MB)
    if (audioFile.size > 5 * 1024 * 1024) {
      return NextResponse.json({ error: "File too large (max 5MB)" }, { status: 400 });
    }

    await ensureVoiceDir();

    const messageId = uuid();
    const fileName = `${messageId}.webm`;
    const filePath = path.join(VOICE_DIR, fileName);

    // Save the audio file
    const arrayBuffer = await audioFile.arrayBuffer();
    await writeFile(filePath, Buffer.from(arrayBuffer));

    // Insert message record
    const now = new Date().toISOString();
    const message = {
      id: messageId,
      conversationId,
      senderId: session.userId,
      senderType: session.userType,
      senderName: session.name,
      content: "🎤 Voice message",
      messageType: "voice" as const,
      metadata: JSON.stringify({ fileName, durationMs, fileSize: audioFile.size }),
      createdAt: now,
    };

    sqlite.prepare(`
      INSERT INTO messages (id, conversation_id, sender_id, sender_type, sender_name, content, type, metadata, created_at)
      VALUES (?, ?, ?, ?, ?, ?, 'voice', ?, ?)
    `).run(
      messageId,
      conversationId,
      session.userId,
      session.userType,
      session.name,
      "🎤 Voice message",
      JSON.stringify({ fileName, durationMs, fileSize: audioFile.size }),
      now
    );

    // Un-hide the conversation for any member who had soft-deleted it
    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId)).get();
    if (conv) {
      const deletedBy: string[] = JSON.parse(conv.deletedBy || "[]");
      const updatedDeletedBy = deletedBy.filter((id) => id === session.userId);
      if (updatedDeletedBy.length !== deletedBy.length) {
        db.update(schema.conversations)
          .set({ deletedBy: JSON.stringify(updatedDeletedBy) })
          .where(eq(schema.conversations.id, conversationId)).run();
      }
    }

    // Update conversation last message
    sqlite.prepare(`
      UPDATE conversations SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?
    `).run("🎤 Voice message", now, now, conversationId);

    // Send push notifications to ARLs
    if (conv) {
      const members = db.select().from(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, conversationId)).all();
      const arlMemberIds = members
        .filter((m) => m.memberType === "arl" && m.memberId !== session.userId)
        .map((m) => m.memberId);

      if (conv.type === "direct") {
        const otherId = conv.participantAId === session.userId ? conv.participantBId : conv.participantAId;
        const otherType = conv.participantAId === session.userId ? conv.participantBType : conv.participantAType;
        if (otherId && otherType === "arl") {
          await sendPushToARL(otherId, {
            title: `New voice message from ${session.name}`,
            body: "🎤 Voice message",
            url: `/arl?tab=messaging&conversation=${conversationId}`,
            conversationId,
          });
        }
      } else if (conv.type === "global") {
        const allArls = db.select().from(schema.arls).where(eq(schema.arls.isActive, true)).all();
        for (const arl of allArls) {
          if (arl.id !== session.userId) {
            await sendPushToARL(arl.id, {
              title: `Global Chat: ${session.name}`,
              body: "🎤 Voice message",
              url: `/arl?tab=messaging&conversation=${conversationId}`,
              conversationId,
            });
          }
        }
      } else if (conv.type === "group") {
        for (const arlId of arlMemberIds) {
          await sendPushToARL(arlId, {
            title: `${conv.name || "Group"}: ${session.name}`,
            body: "🎤 Voice message",
            url: `/arl?tab=messaging&conversation=${conversationId}`,
            conversationId,
          });
        }
      }
    }

    // Create in-app notifications for all members except sender
    const members = db.select().from(schema.conversationMembers)
      .where(eq(schema.conversationMembers.conversationId, conversationId)).all();
    
    for (const member of members) {
      if (member.memberId !== session.userId) {
        await createNotification({
          userId: member.memberId,
          userType: member.memberType as "location" | "arl",
          type: "new_message",
          title: `Voice message from ${session.name}`,
          message: "🎤 Voice message",
          actionUrl: member.memberType === "arl" ? `/arl?view=messages` : `/dashboard`,
          actionLabel: "View Message",
          priority: "normal",
          metadata: {
            conversationId,
            senderId: session.userId,
            senderName: session.name,
          },
        });
      }
    }

    // Broadcast via WebSocket for instant delivery
    broadcastNewMessage(conversationId, message);
    broadcastConversationUpdate(conversationId);

    return NextResponse.json({
      id: messageId,
      fileName,
      durationMs,
      url: `/api/messages/voice/${messageId}`,
    });
  } catch (error) {
    console.error("Voice message upload error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
