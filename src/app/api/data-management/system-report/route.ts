import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema, sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    // Record counts
    const locations = db.select().from(schema.locations).all().length;
    const arls = db.select().from(schema.arls).all().length;
    const tasks = db.select().from(schema.tasks).all().length;
    const messages = db.select().from(schema.messages).all().length;
    const conversations = db.select().from(schema.conversations).all().length;
    const sessions = db.select().from(schema.sessions).all().length;
    const onlineSessions = db.select().from(schema.sessions).all().filter((s: any) => s.isOnline).length;

    let taskCompletions = 0;
    try { taskCompletions = db.select().from(schema.taskCompletions).all().length; } catch (e) { console.error("System report: taskCompletions count error:", e); }
    let messageReads = 0;
    try { messageReads = db.select().from(schema.messageReads).all().length; } catch (e) { console.error("System report: messageReads count error:", e); }
    let messageReactions = 0;
    try { messageReactions = db.select().from(schema.messageReactions).all().length; } catch (e) { console.error("System report: messageReactions count error:", e); }
    let forms = 0;
    try { forms = db.select().from(schema.forms).all().length; } catch (e) { console.error("System report: forms count error:", e); }
    let broadcasts = 0;
    try { broadcasts = db.select().from(schema.broadcasts).all().length; } catch (e) { console.error("System report: broadcasts count error:", e); }
    let broadcastMessages = 0;
    try { broadcastMessages = db.select().from(schema.broadcastMessages).all().length; } catch (e) { console.error("System report: broadcastMessages count error:", e); }
    let broadcastQuestions = 0;
    try { broadcastQuestions = db.select().from(schema.broadcastQuestions).all().length; } catch (e) { console.error("System report: broadcastQuestions count error:", e); }
    let emergencyMessages = 0;
    try { emergencyMessages = db.select().from(schema.emergencyMessages).all().length; } catch (e) { console.error("System report: emergencyMessages count error:", e); }
    let notifications = 0;
    try { notifications = db.select().from(schema.notifications).all().length; } catch (e) { console.error("System report: notifications count error:", e); }

    // Table sizes
    const tableInfo = sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as { name: string }[];

    const tableSizes = tableInfo.map((t) => {
      try {
        const count = (sqlite.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get() as any)?.c || 0;
        return { name: t.name, records: count };
      } catch {
        return { name: t.name, records: 0 };
      }
    });

    return apiSuccess({
      generatedAt: new Date().toISOString(),
      database: {
        path: dbPath,
        size: dbSize,
        sizeFormatted: formatBytes(dbSize),
        tables: tableSizes,
      },
      counts: {
        locations,
        arls,
        tasks,
        taskCompletions,
        messages,
        messageReads,
        messageReactions,
        conversations,
        sessions,
        onlineSessions,
        forms,
        broadcasts,
        broadcastMessages,
        broadcastQuestions,
        emergencyMessages,
        notifications,
      },
      system: {
        nodeVersion: process.version,
        platform: process.platform,
        uptime: process.uptime(),
        uptimeFormatted: formatUptime(process.uptime()),
        memoryUsage: process.memoryUsage(),
        memoryFormatted: formatBytes(process.memoryUsage().heapUsed),
      },
    });
  } catch (error) {
    console.error("System report error:", error);
    return ApiErrors.internal();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}

function formatUptime(seconds: number): string {
  const d = Math.floor(seconds / 86400);
  const h = Math.floor((seconds % 86400) / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const parts = [];
  if (d > 0) parts.push(`${d}d`);
  if (h > 0) parts.push(`${h}h`);
  parts.push(`${m}m`);
  return parts.join(" ");
}
