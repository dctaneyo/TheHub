import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { writeFile, mkdir } from "fs/promises";
import { join } from "path";
import { createNotificationBulk } from "@/lib/notifications";
import { validate, uploadFormSchema, deleteFormSchema } from "@/lib/validations";

const FORMS_DIR = join(process.cwd(), "data", "forms");

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const forms = db.select().from(schema.forms).where(eq(schema.forms.tenantId, session.tenantId)).orderBy(schema.forms.createdAt).all();
    return apiSuccess({ forms });
  } catch (error) {
    console.error("Get forms error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL only");
    }
    const denied = await requirePermission(session, PERMISSIONS.FORMS_UPLOAD);
    if (denied) return denied;

    const formData = await req.formData();
    const file = formData.get("file") as File | null;
    if (!file) {
      return ApiErrors.badRequest("file is required");
    }
    if (!file.name.endsWith(".pdf")) {
      return ApiErrors.badRequest("Only PDF files allowed");
    }

    const parsed = validate(uploadFormSchema, {
      title: formData.get("title"),
      description: formData.get("description"),
      category: formData.get("category"),
    });
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { title, description, category } = parsed.data;

    const bytes = await file.arrayBuffer();
    const fileBuffer = Buffer.from(bytes);

    // Also write to disk as fallback (may not persist on Railway)
    try {
      await mkdir(FORMS_DIR, { recursive: true });
      const fileName = `${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
      await writeFile(join(FORMS_DIR, fileName), fileBuffer);
    } catch (e) {
      console.error("Failed to write form to disk:", e);
    }

    const fileName = `${uuid()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const now = new Date().toISOString();
    const form = {
      id: uuid(),
      tenantId: session.tenantId,
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
    const allLocations = db.select().from(schema.locations).where(and(eq(schema.locations.isActive, true), eq(schema.locations.tenantId, session.tenantId))).all();
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

    return apiSuccess({ form });
  } catch (error) {
    console.error("Upload form error:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL only");
    }
    const denied = await requirePermission(session, PERMISSIONS.FORMS_DELETE);
    if (denied) return denied;
    const body = await req.json();
    const parsed = validate(deleteFormSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { id } = parsed.data;
    db.delete(schema.forms).where(and(eq(schema.forms.id, id), eq(schema.forms.tenantId, session.tenantId))).run();
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete form error:", error);
    return ApiErrors.internal();
  }
}
