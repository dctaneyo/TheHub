import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { validate, createScheduledReportSchema, updateScheduledReportSchema } from "@/lib/validations";

function computeNextRunAt(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      now.setHours(6, 0, 0, 0); // 6 AM next day
      break;
    case "weekly":
      now.setDate(now.getDate() + (7 - now.getDay() + 1)); // next Monday
      now.setHours(6, 0, 0, 0);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1, 1); // 1st of next month
      now.setHours(6, 0, 0, 0);
      break;
  }
  return now.toISOString();
}

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const reports = db.select().from(schema.scheduledReports)
      .where(eq(schema.scheduledReports.tenantId, session.tenantId)).all();

    const reportsWithHistory = reports.map((report) => {
      const history = db.select({
        id: schema.reportHistory.id,
        status: schema.reportHistory.status,
        error: schema.reportHistory.error,
        createdAt: schema.reportHistory.createdAt,
        completedAt: schema.reportHistory.completedAt,
      }).from(schema.reportHistory)
        .where(eq(schema.reportHistory.reportId, report.id)).all()
        .slice(0, 10); // last 10 runs

      return {
        ...report,
        recipients: JSON.parse(report.recipients || "[]"),
        filters: report.filters ? JSON.parse(report.filters) : null,
        history,
      };
    });

    return apiSuccess({ reports: reportsWithHistory });
  } catch (error) {
    console.error("Get reports error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(createScheduledReportSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { name, type, frequency, recipients, filters } = parsed.data;

    const now = new Date().toISOString();
    const report = {
      id: uuid(),
      tenantId: session.tenantId,
      name: name.trim(),
      type,
      frequency,
      recipients: JSON.stringify(recipients),
      filters: filters ? JSON.stringify(filters) : null,
      lastRunAt: null,
      nextRunAt: computeNextRunAt(frequency),
      isActive: true,
      createdBy: session.id,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.scheduledReports).values(report).run();
    return apiSuccess({
      report: { ...report, recipients, filters: filters || null },
    });
  } catch (error) {
    console.error("Create report error:", error);
    return ApiErrors.internal();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(updateScheduledReportSchema, body);
    if (!parsed.success) {
      return ApiErrors.badRequest(parsed.error);
    }
    const { id, name, type, frequency, recipients, filters, isActive } = parsed.data;

    const existing = db.select().from(schema.scheduledReports)
      .where(and(eq(schema.scheduledReports.id, id), eq(schema.scheduledReports.tenantId, session.tenantId))).get();
    if (!existing) return ApiErrors.notFound("Report");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (type !== undefined) updates.type = type;
    if (frequency !== undefined) {
      updates.frequency = frequency;
      updates.nextRunAt = computeNextRunAt(frequency);
    }
    if (recipients !== undefined) updates.recipients = JSON.stringify(recipients);
    if (filters !== undefined) updates.filters = filters ? JSON.stringify(filters) : null;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.scheduledReports).set(updates)
      .where(and(eq(schema.scheduledReports.id, id), eq(schema.scheduledReports.tenantId, session.tenantId))).run();

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update report error:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.forbidden("ARL access required");
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("id required");

    const existing = db.select().from(schema.scheduledReports)
      .where(and(eq(schema.scheduledReports.id, id), eq(schema.scheduledReports.tenantId, session.tenantId))).get();
    if (!existing) return ApiErrors.notFound("Report");

    // Delete history first
    db.delete(schema.reportHistory)
      .where(eq(schema.reportHistory.reportId, id)).run();

    // Delete the report
    db.delete(schema.scheduledReports)
      .where(and(eq(schema.scheduledReports.id, id), eq(schema.scheduledReports.tenantId, session.tenantId))).run();

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete report error:", error);
    return ApiErrors.internal();
  }
}
