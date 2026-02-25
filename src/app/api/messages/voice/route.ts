import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

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
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
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

    // Update conversation last message
    sqlite.prepare(`
      UPDATE conversations SET last_message = ?, last_message_at = ?, updated_at = ? WHERE id = ?
    `).run("🎤 Voice message", now, now, conversationId);

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
