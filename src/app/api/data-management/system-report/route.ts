import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema, sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
    const dbSize = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    // Record counts
    const locations = (await db.select().from(schema.locations).all()).length;
    const arls = (await db.select().from(schema.arls).all()).length;
    const tasks = (await db.select().from(schema.tasks).all()).length;
    const messages = (await db.select().from(schema.messages).all()).length;
    const conversations = (await db.select().from(schema.conversations).all()).length;
    const sessions = (await db.select().from(schema.sessions).all()).length;
    const onlineSessions = (await db.select().from(schema.sessions).all()).filter((s: any) => s.isOnline).length;

    let taskCompletions = 0;
    try { taskCompletions = (await db.select().from(schema.taskCompletions).all()).length; } catch {}
    let messageReads = 0;
    try { messageReads = (await db.select().from(schema.messageReads).all()).length; } catch {}
    let messageReactions = 0;
    try { messageReactions = (await db.select().from(schema.messageReactions).all()).length; } catch {}
    let forms = 0;
    try { forms = (await db.select().from(schema.forms).all()).length; } catch {}
    let broadcasts = 0;
    try { broadcasts = (await db.select().from(schema.broadcasts).all()).length; } catch {}
    let broadcastMessages = 0;
    try { broadcastMessages = (await db.select().from(schema.broadcastMessages).all()).length; } catch {}
    let broadcastQuestions = 0;
    try { broadcastQuestions = (await db.select().from(schema.broadcastQuestions).all()).length; } catch {}
    let emergencyMessages = 0;
    try { emergencyMessages = (await db.select().from(schema.emergencyMessages).all()).length; } catch {}
    let notifications = 0;
    try { notifications = (await db.select().from(schema.notifications).all()).length; } catch {}

    // Table sizes
    const tableInfo = await sqlite.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
    ).all() as unknown as { name: string }[];

    const tableSizes = await Promise.all(tableInfo.map(async (t) => {
      try {
        const count = ((await sqlite.prepare(`SELECT COUNT(*) as c FROM "${t.name}"`).get()) as any)?.c || 0;
        return { name: t.name, records: count };
      } catch {
        return { name: t.name, records: 0 };
      }
    }));

    return NextResponse.json({
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
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
