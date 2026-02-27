import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    const { dataType, daysOld } = await request.json();

    // Create archive tables if they don't exist
    try {
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_messages (
          id TEXT PRIMARY KEY,
          conversation_id TEXT,
          sender_type TEXT,
          sender_id TEXT,
          sender_name TEXT,
          content TEXT,
          message_type TEXT,
          created_at TEXT,
          archived_at TEXT
        )
      `);
      sqlite.exec(`
        CREATE TABLE IF NOT EXISTS archived_task_completions (
          id TEXT PRIMARY KEY,
          task_id TEXT,
          location_id TEXT,
          completed_at TEXT,
          completed_date TEXT,
          notes TEXT,
          points_earned INTEGER,
          bonus_points INTEGER,
          archived_at TEXT
        )
      `);
    } catch {}

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - (daysOld || 180));
    const cutoff = cutoffDate.toISOString();
    const archivedAt = new Date().toISOString();

    let archived = 0;

    if (dataType === "messages") {
      // Move old messages to archive
      const result = sqlite.prepare(`
        INSERT INTO archived_messages 
        SELECT id, conversation_id, sender_type, sender_id, sender_name, content, message_type, created_at, ? as archived_at
        FROM messages 
        WHERE created_at < ?
      `).run(archivedAt, cutoff);
      
      // Delete from main table
      const deleted = sqlite.prepare("DELETE FROM messages WHERE created_at < ?").run(cutoff);
      archived = deleted.changes;
    } else if (dataType === "task-completions") {
      // Move old task completions to archive
      const result = sqlite.prepare(`
        INSERT INTO archived_task_completions 
        SELECT id, task_id, location_id, completed_at, completed_date, notes, points_earned, bonus_points, ? as archived_at
        FROM task_completions 
        WHERE completed_date < ?
      `).run(archivedAt, cutoff.split("T")[0]);
      
      // Delete from main table
      const deleted = sqlite.prepare("DELETE FROM task_completions WHERE completed_date < ?").run(cutoff.split("T")[0]);
      archived = deleted.changes;
    } else {
      return NextResponse.json({ error: "Invalid data type" }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      archived,
      dataType,
      cutoffDate: cutoff,
      daysOld,
    });
  } catch (error) {
    console.error("Archive old data error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Get archive statistics
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    let archivedMessages = 0;
    let archivedCompletions = 0;

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM archived_messages").get() as any;
      archivedMessages = r?.c || 0;
    } catch {}

    try {
      const r = sqlite.prepare("SELECT COUNT(*) as c FROM archived_task_completions").get() as any;
      archivedCompletions = r?.c || 0;
    } catch {}

    return NextResponse.json({
      archivedMessages,
      archivedCompletions,
      total: archivedMessages + archivedCompletions,
    });
  } catch (error) {
    console.error("Get archive stats error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
