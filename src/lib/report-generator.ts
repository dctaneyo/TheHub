import { db, schema } from "@/lib/db";
import { eq, and, gte, lte } from "drizzle-orm";
import { v4 as uuid } from "uuid";

interface ReportData {
  title: string;
  generatedAt: string;
  frequency: string;
  dateRange: { start: string; end: string };
  sections: ReportSection[];
}

interface ReportSection {
  heading: string;
  rows: Record<string, string | number>[];
  summary?: Record<string, string | number>;
}

function getDateRange(frequency: string): { start: string; end: string } {
  const now = new Date();
  const end = now.toISOString().split("T")[0];
  let start: string;

  switch (frequency) {
    case "daily":
      start = end; // today only
      break;
    case "weekly": {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      start = weekAgo.toISOString().split("T")[0];
      break;
    }
    case "monthly": {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      start = monthAgo.toISOString().split("T")[0];
      break;
    }
    default:
      start = end;
  }
  return { start, end };
}

function generateTaskCompletionReport(tenantId: string, dateRange: { start: string; end: string }, filters?: { locationIds?: string[]; groupIds?: string[] }): ReportSection[] {
  const locations = db.select().from(schema.locations)
    .where(eq(schema.locations.tenantId, tenantId)).all();

  // Filter locations if needed
  let filteredLocationIds = locations.map((l) => l.id);
  if (filters?.locationIds && filters.locationIds.length > 0) {
    filteredLocationIds = filters.locationIds;
  }
  if (filters?.groupIds && filters.groupIds.length > 0) {
    const groupMembers = filters.groupIds.flatMap((gId) =>
      db.select({ locationId: schema.locationGroupMembers.locationId })
        .from(schema.locationGroupMembers)
        .where(eq(schema.locationGroupMembers.groupId, gId)).all()
        .map((m) => m.locationId)
    );
    filteredLocationIds = filteredLocationIds.filter((id) => groupMembers.includes(id));
  }

  const filteredLocations = locations.filter((l) => filteredLocationIds.includes(l.id));

  // Get all tasks for tenant
  const tasks = db.select().from(schema.tasks)
    .where(eq(schema.tasks.tenantId, tenantId)).all();

  // Get completions in date range
  const completions = db.select().from(schema.taskCompletions).all()
    .filter((c) => c.completedDate >= dateRange.start && c.completedDate <= dateRange.end);

  const rows = filteredLocations.map((loc) => {
    const locCompletions = completions.filter((c) => c.locationId === loc.id);
    const totalTasks = tasks.filter((t) => !t.locationId || t.locationId === loc.id).length;
    const dayCount = Math.max(1, Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000) + 1);
    const expectedTotal = totalTasks * dayCount;
    const completedTotal = locCompletions.length;
    const rate = expectedTotal > 0 ? Math.round((completedTotal / expectedTotal) * 100) : 0;

    return {
      Location: loc.name,
      "Store #": loc.storeNumber,
      Completed: completedTotal,
      Expected: expectedTotal,
      "Rate (%)": rate,
      Points: locCompletions.reduce((sum, c) => sum + (c.pointsEarned || 0), 0),
    };
  });

  const totalCompleted = rows.reduce((sum, r) => sum + (r.Completed as number), 0);
  const totalExpected = rows.reduce((sum, r) => sum + (r.Expected as number), 0);

  return [{
    heading: "Task Completion by Location",
    rows,
    summary: {
      "Total Completed": totalCompleted,
      "Total Expected": totalExpected,
      "Overall Rate (%)": totalExpected > 0 ? Math.round((totalCompleted / totalExpected) * 100) : 0,
    },
  }];
}

function generateLeaderboardReport(tenantId: string, dateRange: { start: string; end: string }, filters?: { locationIds?: string[]; groupIds?: string[] }): ReportSection[] {
  const leaderboard = db.select().from(schema.dailyLeaderboard)
    .where(eq(schema.dailyLeaderboard.tenantId, tenantId)).all()
    .filter((l) => l.date >= dateRange.start && l.date <= dateRange.end);

  const locations = db.select().from(schema.locations)
    .where(eq(schema.locations.tenantId, tenantId)).all();

  const locationMap = new Map(locations.map((l) => [l.id, l]));

  // Aggregate by location
  const aggregated = new Map<string, { points: number; completed: number; missed: number; streak: number }>();
  for (const entry of leaderboard) {
    const existing = aggregated.get(entry.locationId) || { points: 0, completed: 0, missed: 0, streak: 0 };
    existing.points += entry.pointsEarned;
    existing.completed += entry.tasksCompleted;
    existing.missed += entry.tasksMissed;
    existing.streak = Math.max(existing.streak, entry.streak);
    aggregated.set(entry.locationId, existing);
  }

  let rows = Array.from(aggregated.entries())
    .map(([locId, stats]) => {
      const loc = locationMap.get(locId);
      return {
        Rank: 0,
        Location: loc?.name || "Unknown",
        "Store #": loc?.storeNumber || "?",
        Points: stats.points,
        "Tasks Done": stats.completed,
        "Tasks Missed": stats.missed,
        "Best Streak": stats.streak,
      };
    })
    .sort((a, b) => b.Points - a.Points);

  // Apply filters
  if (filters?.locationIds && filters.locationIds.length > 0) {
    const locNames = new Set(
      locations.filter((l) => filters.locationIds!.includes(l.id)).map((l) => l.name)
    );
    rows = rows.filter((r) => locNames.has(r.Location));
  }

  rows.forEach((r, i) => { r.Rank = i + 1; });

  return [{
    heading: "Leaderboard Rankings",
    rows,
    summary: {
      "Total Locations": rows.length,
      "Total Points": rows.reduce((sum, r) => sum + r.Points, 0),
    },
  }];
}

function generateAttendanceReport(tenantId: string, dateRange: { start: string; end: string }): ReportSection[] {
  const locations = db.select().from(schema.locations)
    .where(eq(schema.locations.tenantId, tenantId)).all();

  const sessions = db.select().from(schema.sessions).all()
    .filter((s) => s.createdAt >= dateRange.start && s.createdAt <= dateRange.end + "T23:59:59");

  const rows = locations.map((loc) => {
    const locSessions = sessions.filter((s) => s.userId === loc.id);
    const uniqueDays = new Set(locSessions.map((s) => s.createdAt.split("T")[0])).size;
    const dayCount = Math.max(1, Math.ceil((new Date(dateRange.end).getTime() - new Date(dateRange.start).getTime()) / 86400000) + 1);

    return {
      Location: loc.name,
      "Store #": loc.storeNumber,
      "Sessions": locSessions.length,
      "Active Days": uniqueDays,
      "Total Days": dayCount,
      "Attendance (%)": Math.round((uniqueDays / dayCount) * 100),
    };
  });

  return [{
    heading: "Location Attendance",
    rows: rows.sort((a, b) => b["Attendance (%)"] - a["Attendance (%)"]),
    summary: {
      "Avg Attendance (%)": rows.length > 0 ? Math.round(rows.reduce((sum, r) => sum + r["Attendance (%)"], 0) / rows.length) : 0,
    },
  }];
}

function generateMessagingReport(tenantId: string, dateRange: { start: string; end: string }): ReportSection[] {
  const conversations = db.select().from(schema.conversations)
    .where(eq(schema.conversations.tenantId, tenantId)).all();

  const convIds = new Set(conversations.map((c) => c.id));
  const messages = db.select().from(schema.messages).all()
    .filter((m) => convIds.has(m.conversationId) && m.createdAt >= dateRange.start && m.createdAt <= dateRange.end + "T23:59:59");

  // By sender
  const bySender = new Map<string, { count: number; name: string }>();
  for (const msg of messages) {
    const existing = bySender.get(msg.senderId) || { count: 0, name: msg.senderName };
    existing.count++;
    bySender.set(msg.senderId, existing);
  }

  const rows = Array.from(bySender.entries())
    .map(([, stats]) => ({
      Sender: stats.name,
      "Messages Sent": stats.count,
    }))
    .sort((a, b) => b["Messages Sent"] - a["Messages Sent"])
    .slice(0, 20); // Top 20

  return [{
    heading: "Messaging Activity (Top 20)",
    rows,
    summary: {
      "Total Messages": messages.length,
      "Active Conversations": new Set(messages.map((m) => m.conversationId)).size,
    },
  }];
}

/**
 * Generate a report as structured data. Can be converted to HTML/PDF later.
 */
export function generateReport(
  report: { name: string; type: string; frequency: string; tenantId: string; filters: string | null }
): ReportData {
  const dateRange = getDateRange(report.frequency);
  const filters = report.filters ? JSON.parse(report.filters) : undefined;

  let sections: ReportSection[];
  switch (report.type) {
    case "task_completion":
      sections = generateTaskCompletionReport(report.tenantId, dateRange, filters);
      break;
    case "leaderboard":
      sections = generateLeaderboardReport(report.tenantId, dateRange, filters);
      break;
    case "attendance":
      sections = generateAttendanceReport(report.tenantId, dateRange);
      break;
    case "messaging":
      sections = generateMessagingReport(report.tenantId, dateRange);
      break;
    default:
      sections = [];
  }

  return {
    title: report.name,
    generatedAt: new Date().toISOString(),
    frequency: report.frequency,
    dateRange,
    sections,
  };
}

/**
 * Convert report data to an HTML string suitable for email or PDF conversion.
 */
export function reportToHtml(data: ReportData): string {
  const sectionHtml = data.sections.map((section) => {
    const headers = section.rows.length > 0 ? Object.keys(section.rows[0]) : [];
    const headerRow = headers.map((h) => `<th style="padding:8px 12px;text-align:left;border-bottom:2px solid #e5e7eb;font-size:12px;color:#6b7280;">${h}</th>`).join("");
    const bodyRows = section.rows.map((row) =>
      `<tr>${headers.map((h) => `<td style="padding:6px 12px;border-bottom:1px solid #f3f4f6;font-size:13px;">${row[h]}</td>`).join("")}</tr>`
    ).join("");

    const summaryHtml = section.summary
      ? `<div style="margin-top:12px;padding:12px;background:#f9fafb;border-radius:8px;">
          ${Object.entries(section.summary).map(([k, v]) => `<span style="margin-right:24px;font-size:13px;"><strong>${k}:</strong> ${v}</span>`).join("")}
        </div>`
      : "";

    return `
      <h2 style="font-size:16px;color:#111827;margin:24px 0 12px;">${section.heading}</h2>
      <table style="width:100%;border-collapse:collapse;">
        <thead><tr>${headerRow}</tr></thead>
        <tbody>${bodyRows}</tbody>
      </table>
      ${summaryHtml}
    `;
  }).join("");

  return `
    <!DOCTYPE html>
    <html>
    <head><meta charset="utf-8"><title>${data.title}</title></head>
    <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;max-width:800px;margin:0 auto;padding:24px;color:#374151;">
      <div style="background:linear-gradient(135deg,#dc2626,#991b1b);color:white;padding:24px;border-radius:12px;margin-bottom:24px;">
        <h1 style="margin:0;font-size:20px;">${data.title}</h1>
        <p style="margin:4px 0 0;font-size:13px;opacity:0.9;">
          ${data.frequency.charAt(0).toUpperCase() + data.frequency.slice(1)} Report &middot;
          ${data.dateRange.start} to ${data.dateRange.end} &middot;
          Generated ${new Date(data.generatedAt).toLocaleDateString()}
        </p>
      </div>
      ${sectionHtml}
      <hr style="border:none;border-top:1px solid #e5e7eb;margin:32px 0 16px;">
      <p style="font-size:11px;color:#9ca3af;text-align:center;">
        This report was automatically generated by The Hub. Do not reply to this email.
      </p>
    </body>
    </html>
  `;
}

/**
 * Process all due scheduled reports. Called by the cron job.
 */
export async function processScheduledReports(): Promise<{ processed: number; errors: number }> {
  const now = new Date().toISOString();
  let processed = 0;
  let errors = 0;

  // Find all active reports that are due
  const dueReports = db.select().from(schema.scheduledReports).all()
    .filter((r) => r.isActive && r.nextRunAt && r.nextRunAt <= now);

  for (const report of dueReports) {
    const historyId = uuid();
    try {
      // Create history entry
      db.insert(schema.reportHistory).values({
        id: historyId,
        reportId: report.id,
        tenantId: report.tenantId,
        status: "generating",
        createdAt: now,
      }).run();

      // Generate report
      const reportData = generateReport(report);
      const html = reportToHtml(reportData);

      // Store result
      db.update(schema.reportHistory).set({
        status: "completed",
        fileContent: Buffer.from(html, "utf-8"),
        completedAt: new Date().toISOString(),
      }).where(eq(schema.reportHistory.id, historyId)).run();

      // Update next run
      const nextRun = computeNextRunFromFrequency(report.frequency);
      db.update(schema.scheduledReports).set({
        lastRunAt: now,
        nextRunAt: nextRun,
        updatedAt: new Date().toISOString(),
      }).where(eq(schema.scheduledReports.id, report.id)).run();

      // TODO: Send email with html content to recipients
      // For now, the report is stored in report_history and can be viewed/downloaded
      const recipients = JSON.parse(report.recipients || "[]");
      console.log(`📊 Report "${report.name}" generated for ${recipients.length} recipients`);

      processed++;
    } catch (err) {
      console.error(`❌ Report "${report.name}" failed:`, err);
      db.update(schema.reportHistory).set({
        status: "failed",
        error: String(err),
        completedAt: new Date().toISOString(),
      }).where(eq(schema.reportHistory.id, historyId)).run();
      errors++;
    }
  }

  return { processed, errors };
}

function computeNextRunFromFrequency(frequency: string): string {
  const now = new Date();
  switch (frequency) {
    case "daily":
      now.setDate(now.getDate() + 1);
      now.setHours(6, 0, 0, 0);
      break;
    case "weekly":
      now.setDate(now.getDate() + 7);
      now.setHours(6, 0, 0, 0);
      break;
    case "monthly":
      now.setMonth(now.getMonth() + 1);
      now.setHours(6, 0, 0, 0);
      break;
  }
  return now.toISOString();
}
