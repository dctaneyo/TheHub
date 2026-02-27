import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";

const VOICE_DIR = path.join(process.cwd(), "data", "voice-messages");

// GET - Stream a voice message file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { id } = await params;
    const filePath = path.join(VOICE_DIR, `${id}.webm`);

    if (!existsSync(filePath)) {
      return NextResponse.json({ error: "Voice message not found" }, { status: 404 });
    }

    const fileBuffer = await readFile(filePath);

    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/webm",
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Voice message retrieval error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
