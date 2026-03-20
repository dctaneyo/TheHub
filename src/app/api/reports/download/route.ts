import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { generateReport, reportToHtml } from "@/lib/report-generator";

export async function GET(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const { searchParams } = new URL(req.url);
    const reportId = searchParams.get("reportId");
    const historyId = searchParams.get("historyId");

    // If historyId is provided, return the stored report
    if (historyId) {
      const history = db.select().from(schema.reportHistory)
        .where(and(
          eq(schema.reportHistory.id, historyId),
          eq(schema.reportHistory.tenantId, session.tenantId)
        )).get();

      if (!history) return ApiErrors.notFound("Report");
      if (!history.fileContent) return ApiErrors.notFound("Report content");

      const buf = Buffer.isBuffer(history.fileContent) ? history.fileContent : Buffer.from(history.fileContent as ArrayBuffer);
      return new NextResponse(new Uint8Array(buf), {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="report-${historyId}.html"`,
        },
      });
    }

    // If reportId is provided, generate a fresh report on-demand
    if (reportId) {
      const report = db.select().from(schema.scheduledReports)
        .where(and(
          eq(schema.scheduledReports.id, reportId),
          eq(schema.scheduledReports.tenantId, session.tenantId)
        )).get();

      if (!report) return ApiErrors.notFound("Report");

      const data = generateReport(report);
      const html = reportToHtml(data);

      return new NextResponse(html, {
        status: 200,
        headers: {
          "Content-Type": "text/html; charset=utf-8",
          "Content-Disposition": `inline; filename="${report.name.replace(/[^a-z0-9]/gi, '-')}.html"`,
        },
      });
    }

    return ApiErrors.badRequest("reportId or historyId required");
  } catch (error) {
    console.error("Download report error:", error);
    return ApiErrors.internal();
  }
}
