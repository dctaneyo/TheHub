import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { broadcastNewMessage, broadcastConversationUpdate } from "@/lib/socket-emit";
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
    const session = await getAuthSession();
    if (!session) return unauthorized();

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
      senderId: session.id,
      senderType: session.userType,
      senderName: session.name,
      content: "🎤 Voice message",
      messageType: "voice" as const,
      metadata: JSON.stringify({ fileName, durationMs, fileSize: audioFile.size }),
      createdAt: now,
    };

    db.insert(schema.messages).values(message).run();

    // Un-hide the conversation for any member who had soft-deleted it
    const conv = db.select().from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId)).get();
    if (conv) {
      const deletedBy: string[] = JSON.parse(conv.deletedBy || "[]");
      const updatedDeletedBy = deletedBy.filter((id) => id === session.id);
      if (updatedDeletedBy.length !== deletedBy.length) {
        db.update(schema.conversations)
          .set({ deletedBy: JSON.stringify(updatedDeletedBy) })
          .where(eq(schema.conversations.id, conversationId)).run();
      }
    }

    // Update conversation last message
    db.update(schema.conversations)
      .set({ lastMessageAt: now, lastMessagePreview: "🎤 Voice message" })
      .where(eq(schema.conversations.id, conversationId)).run();

    // Broadcast via WebSocket FIRST for instant delivery
    broadcastNewMessage(conversationId, message);
    broadcastConversationUpdate(conversationId);

    // Send push notifications to ARLs (best-effort, don't block response)
    try {
      if (conv) {
        if (conv.type === "direct") {
          const otherId = conv.participantAId === session.id ? conv.participantBId : conv.participantAId;
          const otherType = conv.participantAId === session.id ? conv.participantBType : conv.participantAType;
          if (otherId && otherType === "arl") {
            await sendPushToARL(otherId, {
              title: `New voice message from ${session.name}`,
              body: "🎤 Voice message",
              url: `/arl?tab=messaging&conversation=${conversationId}`,
              conversationId,
            });
          }
        } else if (conv.type === "global") {
          const allArls = db.select().from(schema.arls).where(and(eq(schema.arls.isActive, true), eq(schema.arls.tenantId, session.tenantId))).all();
          for (const arl of allArls) {
            if (arl.id !== session.id) {
              await sendPushToARL(arl.id, {
                title: `Global Chat: ${session.name}`,
                body: "🎤 Voice message",
                url: `/arl?tab=messaging&conversation=${conversationId}`,
                conversationId,
              });
            }
          }
        } else if (conv.type === "group") {
          const members = db.select().from(schema.conversationMembers)
            .where(eq(schema.conversationMembers.conversationId, conversationId)).all();
          const arlMemberIds = members
            .filter((m) => m.memberType === "arl" && m.memberId !== session.id)
            .map((m) => m.memberId);
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
    } catch (pushErr) {
      console.error("Push notification error (non-fatal):", pushErr);
    }

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
