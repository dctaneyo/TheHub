import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { readFile } from "fs/promises";
import { join } from "path";

const FORMS_DIR = join(process.cwd(), "data", "forms");

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const { searchParams } = new URL(req.url);
    const id = searchParams.get("id");
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const form = db.select().from(schema.forms).where(eq(schema.forms.id, id)).get();
    if (!form) return NextResponse.json({ error: "Not found" }, { status: 404 });

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
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
