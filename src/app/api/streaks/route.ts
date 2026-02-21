import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

// Ensure streaks table exists
function ensureStreaksTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS streaks (
        location_id TEXT PRIMARY KEY,
        current_streak INTEGER DEFAULT 0,
        longest_streak INTEGER DEFAULT 0,
        last_completion_date TEXT,
        streak_freeze_available INTEGER DEFAULT 0,
        created_at TEXT,
        updated_at TEXT
      )
    `);
  } catch {}
}

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ensureStreaksTable();

    let streak = sqlite.prepare(
      "SELECT * FROM streaks WHERE location_id = ?"
    ).get(session.id) as any;

    if (!streak) {
      // Create initial streak record
      const now = new Date().toISOString();
      sqlite.prepare(`
        INSERT INTO streaks (location_id, current_streak, longest_streak, last_completion_date, streak_freeze_available, created_at, updated_at)
        VALUES (?, 0, 0, NULL, 0, ?, ?)
      `).run(session.id, now, now);
      
      streak = { location_id: session.id, current_streak: 0, longest_streak: 0, last_completion_date: null, streak_freeze_available: 0 };
    }

    // Check if streak should be broken
    const today = new Date().toISOString().split("T")[0];
    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    
    if (streak.last_completion_date && streak.last_completion_date < yesterday && streak.current_streak > 0) {
      // Streak broken (missed a day)
      if (streak.streak_freeze_available > 0) {
        // Use streak freeze
        sqlite.prepare("UPDATE streaks SET streak_freeze_available = streak_freeze_available - 1, updated_at = ? WHERE location_id = ?")
          .run(new Date().toISOString(), session.id);
        streak.streak_freeze_available -= 1;
      } else {
        // Break streak
        sqlite.prepare("UPDATE streaks SET current_streak = 0, updated_at = ? WHERE location_id = ?")
          .run(new Date().toISOString(), session.id);
        streak.current_streak = 0;
      }
    }

    return NextResponse.json(streak);
  } catch (error) {
    console.error("Get streak error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    ensureStreaksTable();

    const today = new Date().toISOString().split("T")[0];
    
    let streak = sqlite.prepare(
      "SELECT * FROM streaks WHERE location_id = ?"
    ).get(session.id) as any;

    if (!streak) {
      // Create new streak
      const now = new Date().toISOString();
      sqlite.prepare(`
        INSERT INTO streaks (location_id, current_streak, longest_streak, last_completion_date, streak_freeze_available, created_at, updated_at)
        VALUES (?, 1, 1, ?, 0, ?, ?)
      `).run(session.id, today, now, now);
      
      return NextResponse.json({ current_streak: 1, longest_streak: 1, milestone: 1 });
    }

    // Don't increment if already completed today
    if (streak.last_completion_date === today) {
      return NextResponse.json({ current_streak: streak.current_streak, longest_streak: streak.longest_streak, milestone: null });
    }

    const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
    let newStreak = streak.current_streak;

    if (streak.last_completion_date === yesterday) {
      // Continue streak
      newStreak = streak.current_streak + 1;
    } else {
      // Start new streak
      newStreak = 1;
    }

    const newLongest = Math.max(newStreak, streak.longest_streak);
    
    // Award streak freeze at milestones (every 30 days)
    const freezeAwarded = newStreak % 30 === 0 ? 1 : 0;

    sqlite.prepare(`
      UPDATE streaks 
      SET current_streak = ?, 
          longest_streak = ?, 
          last_completion_date = ?,
          streak_freeze_available = streak_freeze_available + ?,
          updated_at = ?
      WHERE location_id = ?
    `).run(newStreak, newLongest, today, freezeAwarded, new Date().toISOString(), session.id);

    // Check for milestones
    let milestone = null;
    if ([7, 14, 30, 60, 100, 365].includes(newStreak)) {
      milestone = newStreak;
    }

    return NextResponse.json({ 
      current_streak: newStreak, 
      longest_streak: newLongest, 
      milestone,
      freezeAwarded: freezeAwarded > 0,
    });
  } catch (error) {
    console.error("Update streak error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
