import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";
import { ApiErrors } from "@/lib/api-response";

const FORMS_DIR = join(process.cwd(), "data", "forms");

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return ApiErrors.badRequest("id required");

    const form = db.select().from(schema.forms).where(eq(schema.forms.id, id)).get();
    if (!form) return ApiErrors.notFound("Form");

    let bodyBuffer: Buffer;
    if (form.fileContent) {
      // Prefer DB-stored blob (survives Railway redeployments)
      const raw = form.fileContent as Buffer | Uint8Array | ArrayBuffer;
      bodyBuffer = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
    } else {
      // Fall back to disk
      const filePath = join(FORMS_DIR, form.filePath);
      bodyBuffer = await readFile(filePath);
    }

    // Binary response — keep as raw Response
    return new Response(bodyBuffer.toString("base64"), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${form.fileName}"`,
        "Content-Length": String(bodyBuffer.length),
        "Content-Transfer-Encoding": "base64",
      },
    });
  } catch (error) {
    console.error("Download form error:", error);
    return ApiErrors.notFound("File");
  }
}
