import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) {
      return ApiErrors.unauthorized();
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      return ApiErrors.internal("Email service not configured");
    }

    sgMail.setApiKey(apiKey);

    const { formId } = await req.json();
    if (!formId) {
      return ApiErrors.badRequest("formId required");
    }

    const form = db.select().from(schema.forms).where(eq(schema.forms.id, formId)).get();
    if (!form) {
      return ApiErrors.notFound("Form");
    }

    // Get the recipient's email based on session type
    let recipientEmail: string | null = null;
    let recipientName: string = "Restaurant";

    if (session.userType === "location") {
      const location = db.select().from(schema.locations).where(eq(schema.locations.id, session.id)).get();
      recipientEmail = location?.email || null;
      recipientName = location?.name || "Restaurant";
    } else if (session.userType === "arl") {
      const arl = db.select().from(schema.arls).where(eq(schema.arls.id, session.id)).get();
      recipientEmail = arl?.email || null;
      recipientName = arl?.name || "ARL";
    }

    if (!recipientEmail) {
      return ApiErrors.badRequest("No email address on file for this account");
    }

    let base64Content: string;
    if (form.fileContent) {
      const raw = form.fileContent as Buffer | Uint8Array | ArrayBuffer;
      const buf = Buffer.isBuffer(raw) ? raw : Buffer.from(raw as ArrayBuffer);
      base64Content = buf.toString("base64");
    } else {
      const FORMS_DIR = path.join(process.cwd(), "data", "forms");
      const filePath = path.join(FORMS_DIR, form.filePath);
      if (!fs.existsSync(filePath)) {
        return ApiErrors.notFound("File");
      }
      base64Content = fs.readFileSync(filePath).toString("base64");
    }

    await sgMail.send({
      to: recipientEmail,
      from: fromEmail,
      subject: `[The Hub] Form: ${form.title}`,
      text: `Hi ${recipientName},\n\nPlease find attached the form "${form.title}"${form.description ? `\n\n${form.description}` : ""}\n\nSent via The Hub.`,
      html: `<p>Hi <strong>${recipientName}</strong>,</p><p>Please find attached the form <strong>${form.title}</strong>.</p>${form.description ? `<p>${form.description}</p>` : ""}<p style="color:#888;font-size:12px;">Sent via The Hub</p>`,
      attachments: [
        {
          content: base64Content,
          filename: form.fileName,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Form email-self error:", error);
    return ApiErrors.internal("Failed to send email");
  }
}
