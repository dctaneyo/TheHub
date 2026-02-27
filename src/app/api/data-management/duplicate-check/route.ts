import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    const duplicates: { type: string; description: string; count: number }[] = [];

    // Duplicate conversations (same type + same members)
    try {
      const r = sqlite.prepare(
        `SELECT type, name, COUNT(*) as c FROM conversations GROUP BY type, name HAVING c > 1`
      ).all() as any[];
      for (const row of r) {
        duplicates.push({
          type: "conversation",
          description: `Duplicate "${row.name}" (${row.type})`,
          count: row.c,
        });
      }
    } catch {}

    // Duplicate task completions (same task + same location + same date)
    try {
      const r = sqlite.prepare(
        `SELECT task_id, location_id, completed_date, COUNT(*) as c 
         FROM task_completions 
         GROUP BY task_id, location_id, completed_date 
         HAVING c > 1`
      ).all() as any[];
      if (r.length > 0) {
        const totalDupes = r.reduce((sum: number, row: any) => sum + (row.c - 1), 0);
        duplicates.push({
          type: "task_completion",
          description: `Duplicate task completions (same task, location, date)`,
          count: totalDupes,
        });
      }
    } catch {}

    // Duplicate sessions (same user with multiple active sessions)
    try {
      const r = sqlite.prepare(
        `SELECT user_id, user_type, COUNT(*) as c 
         FROM sessions 
         WHERE is_online = 1 
         GROUP BY user_id, user_type 
         HAVING c > 1`
      ).all() as any[];
      if (r.length > 0) {
        const totalDupes = r.reduce((sum: number, row: any) => sum + (row.c - 1), 0);
        duplicates.push({
          type: "session",
          description: `Users with multiple active sessions`,
          count: totalDupes,
        });
      }
    } catch {}

    return NextResponse.json({
      hasDuplicates: duplicates.length > 0,
      duplicates,
      checkedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Duplicate check error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    let removedCompletions = 0;
    let removedSessions = 0;

    // Remove duplicate task completions (keep the earliest)
    try {
      const r = sqlite.prepare(
        `DELETE FROM task_completions WHERE rowid NOT IN (
          SELECT MIN(rowid) FROM task_completions GROUP BY task_id, location_id, completed_date
        )`
      ).run();
      removedCompletions = r.changes;
    } catch {}

    // Remove duplicate online sessions (keep the newest)
    try {
      const r = sqlite.prepare(
        `DELETE FROM sessions WHERE rowid NOT IN (
          SELECT MAX(rowid) FROM sessions GROUP BY user_id, user_type
        )`
      ).run();
      removedSessions = r.changes;
    } catch {}

    return NextResponse.json({
      success: true,
      removedCompletions,
      removedSessions,
      total: removedCompletions + removedSessions,
    });
  } catch (error) {
    console.error("Duplicate removal error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
