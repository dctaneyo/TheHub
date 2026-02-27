import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createNotificationBulk } from "@/lib/notifications";

const FORMS_DIR = join(process.cwd(), "data", "forms");

export async function GET() {
  try {
    const session = await getSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });

    const forms = db.select().from(schema.forms).orderBy(schema.forms.createdAt).all();
    return NextResponse.json({ forms });
  } catch (error) {
    console.error("Get forms error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL only" }, { status: 403 });
    }

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    const title = formData.get("title") as string;
    const description = formData.get("description") as string | null;
    const category = formData.get("category") as string | null;

    if (!file || !title) {
      return NextResponse.json({ error: "file and title required" }, { status: 400 });
    }
    if (!file.name.endsWith(".pdf")) {
      return NextResponse.json({ error: "Only PDF files allowed" }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    // Also write to disk as fallback (may not persist on Railway)
    try {
      await mkdir(FORMS_DIR, { recursive: true });
      const fileName = `${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await writeFile(join(FORMS_DIR, fileName), fileBuffer);
    } catch {}

    const fileName = `${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const now = new Date().toISOString();
    const form = {
      id: uuid(),
      title,
      description: description || null,
      category: category || "general",
      fileName: file.name,
      filePath: fileName,
      fileContent: fileBuffer, // stored in DB — survives redeployments
      fileSize: file.size,
      uploadedBy: session.id,
      createdAt: now,
    };
    db.insert(schema.forms).values(form).run();

    // Create real-time notification for all active locations
    const allLocations = db.select().from(schema.locations).where(eq(schema.locations.isActive, true)).all();
    await createNotificationBulk(
      allLocations.map(loc => loc.id),
      {
        userType: "location",
        type: "form_uploaded",
        title: "New form available",
        message: `${title} - ${description || 'Check forms repository'}`,
        actionUrl: "/dashboard",
        actionLabel: "View Forms",
        priority: "normal",
        metadata: {
          formId: form.id,
          formTitle: title,
          category: category || "general",
          uploadedBy: session.id,
        },
      }
    );

    return NextResponse.json({ success: true, form });
  } catch (error) {
    console.error("Upload form error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL only" }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.delete(schema.forms).where(eq(schema.forms.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete form error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
