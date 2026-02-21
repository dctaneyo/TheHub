import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";

// Achievement definitions
export const ACHIEVEMENTS = {
  FIRST_TASK: { id: 'first_task', name: 'Getting Started', desc: 'Complete your first task', tier: 'bronze', icon: '🎯' },
  TASKS_10: { id: 'tasks_10', name: 'Task Master', desc: 'Complete 10 tasks', tier: 'bronze', icon: '📋' },
  TASKS_50: { id: 'tasks_50', name: 'Dedicated Worker', desc: 'Complete 50 tasks', tier: 'silver', icon: '⭐' },
  TASKS_100: { id: 'tasks_100', name: 'Century Club', desc: 'Complete 100 tasks', tier: 'gold', icon: '💯' },
  TASKS_500: { id: 'tasks_500', name: 'Task Legend', desc: 'Complete 500 tasks', tier: 'platinum', icon: '👑' },
  
  PERFECT_WEEK: { id: 'perfect_week', name: 'Perfect Week', desc: 'Complete all tasks for 7 days straight', tier: 'gold', icon: '🏆' },
  EARLY_BIRD: { id: 'early_bird', name: 'Early Bird', desc: 'Complete 50 tasks before due time', tier: 'silver', icon: '🌅' },
  SPEED_DEMON: { id: 'speed_demon', name: 'Speed Demon', desc: 'Complete 100 tasks in one day', tier: 'platinum', icon: '⚡' },
  
  STREAK_7: { id: 'streak_7', name: 'Week Warrior', desc: '7-day completion streak', tier: 'bronze', icon: '🔥' },
  STREAK_30: { id: 'streak_30', name: 'Monthly Master', desc: '30-day completion streak', tier: 'silver', icon: '🔥' },
  STREAK_100: { id: 'streak_100', name: 'Streak Legend', desc: '100-day completion streak', tier: 'gold', icon: '🔥' },
  STREAK_365: { id: 'streak_365', name: 'Year Champion', desc: '365-day completion streak', tier: 'platinum', icon: '🔥' },
  
  TEAM_PLAYER: { id: 'team_player', name: 'Team Player', desc: 'Send 500 messages', tier: 'silver', icon: '💬' },
  POINTS_1000: { id: 'points_1000', name: 'Point Collector', desc: 'Earn 1,000 points', tier: 'bronze', icon: '💰' },
  POINTS_5000: { id: 'points_5000', name: 'Point Master', desc: 'Earn 5,000 points', tier: 'silver', icon: '💎' },
  POINTS_10000: { id: 'points_10000', name: 'Point Legend', desc: 'Earn 10,000 points', tier: 'gold', icon: '👑' },
};

function ensureAchievementsTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS achievements (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        achievement_id TEXT NOT NULL,
        unlocked_at TEXT NOT NULL,
        notified INTEGER DEFAULT 0
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

    ensureAchievementsTable();

    const unlocked = sqlite.prepare(
      "SELECT * FROM achievements WHERE location_id = ? ORDER BY unlocked_at DESC"
    ).all(session.id) as any[];

    const unlockedIds = new Set(unlocked.map(a => a.achievement_id));
    
    const all = Object.values(ACHIEVEMENTS).map(achievement => ({
      ...achievement,
      unlocked: unlockedIds.has(achievement.id),
      unlockedAt: unlocked.find(a => a.achievement_id === achievement.id)?.unlocked_at || null,
    }));

    return NextResponse.json({ achievements: all, unlockedCount: unlocked.length, totalCount: Object.keys(ACHIEVEMENTS).length });
  } catch (error) {
    console.error("Get achievements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { achievementId } = await request.json();

    ensureAchievementsTable();

    // Check if already unlocked
    const existing = sqlite.prepare(
      "SELECT * FROM achievements WHERE location_id = ? AND achievement_id = ?"
    ).get(session.id, achievementId);

    if (existing) {
      return NextResponse.json({ alreadyUnlocked: true });
    }

    // Unlock achievement
    sqlite.prepare(`
      INSERT INTO achievements (id, location_id, achievement_id, unlocked_at, notified)
      VALUES (?, ?, ?, ?, 0)
    `).run(uuid(), session.id, achievementId, new Date().toISOString());

    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);

    return NextResponse.json({ unlocked: true, achievement });
  } catch (error) {
    console.error("Unlock achievement error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
