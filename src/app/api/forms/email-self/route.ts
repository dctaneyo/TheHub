import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import sgMail from "@sendgrid/mail";
import fs from "fs";
import path from "path";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    sgMail.setApiKey(apiKey);

    const { formId } = await req.json();
    if (!formId) {
      return NextResponse.json({ error: "formId required" }, { status: 400 });
    }

    const form = db.select().from(schema.forms).where(eq(schema.forms.id, formId)).get();
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
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
      return NextResponse.json({ error: "No email address on file for this account" }, { status: 400 });
    }

    const FORMS_DIR = path.join(process.cwd(), "data", "forms");
    const filePath = path.join(FORMS_DIR, form.filePath);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");

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

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Form email-self error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
