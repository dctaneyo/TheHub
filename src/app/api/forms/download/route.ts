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

    const filePath = join(FORMS_DIR, form.filePath);
    const bytes = await readFile(filePath);

    return new NextResponse(bytes, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${form.fileName}"`,
        "Content-Length": String(bytes.length),
      },
    });
  } catch (error) {
    console.error("Download form error:", error);
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}
