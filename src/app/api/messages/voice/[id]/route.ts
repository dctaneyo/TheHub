import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { readFile } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { ApiErrors } from "@/lib/api-response";

const VOICE_DIR = path.join(process.cwd(), "data", "voice-messages");

// GET - Stream a voice message file
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { id } = await params;
    const filePath = path.join(VOICE_DIR, `${id}.webm`);

    if (!existsSync(filePath)) {
      return ApiErrors.notFound("Voice message");
    }

    const fileBuffer = await readFile(filePath);

    // Binary response — keep as raw NextResponse
    return new NextResponse(fileBuffer, {
      headers: {
        "Content-Type": "audio/webm",
        "Content-Length": String(fileBuffer.length),
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch (error) {
    console.error("Voice message retrieval error:", error);
    return ApiErrors.internal();
  }
}
