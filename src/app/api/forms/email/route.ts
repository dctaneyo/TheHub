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
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const apiKey = process.env.SENDGRID_API_KEY;
    const fromEmail = process.env.SENDGRID_FROM_EMAIL;
    if (!apiKey || !fromEmail) {
      return NextResponse.json({ error: "Email service not configured" }, { status: 500 });
    }

    sgMail.setApiKey(apiKey);

    const { formId, recipientEmails } = await req.json();
    if (!formId || !recipientEmails?.length) {
      return NextResponse.json({ error: "formId and recipientEmails required" }, { status: 400 });
    }

    const form = db.select().from(schema.forms).where(eq(schema.forms.id, formId)).get();
    if (!form) {
      return NextResponse.json({ error: "Form not found" }, { status: 404 });
    }

    const UPLOADS_DIR = process.env.UPLOADS_DIR || path.join(process.cwd(), "data", "uploads");
    const filePath = path.join(UPLOADS_DIR, form.fileName);
    if (!fs.existsSync(filePath)) {
      return NextResponse.json({ error: "File not found on server" }, { status: 404 });
    }

    const fileBuffer = fs.readFileSync(filePath);
    const base64Content = fileBuffer.toString("base64");

    const msg = {
      to: recipientEmails as string[],
      from: fromEmail,
      subject: `[The Hub] Form: ${form.title}`,
      text: `Please find attached the form "${form.title}"${form.description ? `\n\n${form.description}` : ""}\n\nSent via The Hub.`,
      html: `<p>Please find attached the form <strong>${form.title}</strong>.</p>${form.description ? `<p>${form.description}</p>` : ""}<p style="color:#888;font-size:12px;">Sent via The Hub</p>`,
      attachments: [
        {
          content: base64Content,
          filename: form.fileName,
          type: "application/pdf",
          disposition: "attachment",
        },
      ],
    };

    await sgMail.sendMultiple(msg);

    return NextResponse.json({ success: true, sentTo: recipientEmails.length });
  } catch (error) {
    console.error("Form email error:", error);
    return NextResponse.json({ error: "Failed to send email" }, { status: 500 });
  }
}
