import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { createNotification } from "@/lib/notifications";

// Achievement category definitions
export const ACHIEVEMENT_CATEGORIES = {
  tasks: { name: 'Tasks', icon: '✅', color: '#e4002b' },
  streaks: { name: 'Streaks', icon: '🔥', color: '#f59e0b' },
  special: { name: 'Special', icon: '⭐', color: '#8b5cf6' },
  social: { name: 'Social', icon: '👥', color: '#3b82f6' },
  points: { name: 'Points', icon: '💰', color: '#10b981' },
  consistency: { name: 'Consistency', icon: '📊', color: '#06b6d4' },
  hidden: { name: 'Hidden', icon: '❓', color: '#64748b' },
} as const;

export const RARITY_CONFIG = {
  common: { multiplier: 1.0, color: '#94a3b8' },
  uncommon: { multiplier: 1.5, color: '#22c55e' },
  rare: { multiplier: 2.0, color: '#3b82f6' },
  legendary: { multiplier: 3.0, color: '#a855f7' },
  mythic: { multiplier: 5.0, color: '#f59e0b' },
} as const;

// Achievement definitions
export const ACHIEVEMENTS = {
  // ── TASK ACHIEVEMENTS ──
  FIRST_TASK: { id: 'first_task', name: 'Getting Started', desc: 'Complete your first task', tier: 'bronze', icon: '🎯', category: 'tasks', rarity: 'common', points: 10 },
  TASKS_10: { id: 'tasks_10', name: 'Task Master', desc: 'Complete 10 tasks', tier: 'bronze', icon: '📋', category: 'tasks', rarity: 'common', points: 50 },
  TASKS_50: { id: 'tasks_50', name: 'Dedicated Worker', desc: 'Complete 50 tasks', tier: 'silver', icon: '⭐', category: 'tasks', rarity: 'uncommon', points: 150 },
  TASKS_100: { id: 'tasks_100', name: 'Century Club', desc: 'Complete 100 tasks', tier: 'gold', icon: '💯', category: 'tasks', rarity: 'rare', points: 300 },
  TASKS_500: { id: 'tasks_500', name: 'Task Legend', desc: 'Complete 500 tasks', tier: 'platinum', icon: '👑', category: 'tasks', rarity: 'legendary', points: 1000 },
  TASKS_1000: { id: 'tasks_1000', name: 'Task Immortal', desc: 'Complete 1,000 tasks', tier: 'platinum', icon: '🏆', category: 'tasks', rarity: 'mythic', points: 2500 },

  // ── STREAK ACHIEVEMENTS ──
  STREAK_7: { id: 'streak_7', name: 'Week Warrior', desc: '7-day completion streak', tier: 'bronze', icon: '🔥', category: 'streaks', rarity: 'common', points: 100 },
  STREAK_30: { id: 'streak_30', name: 'Monthly Master', desc: '30-day completion streak', tier: 'silver', icon: '🔥', category: 'streaks', rarity: 'rare', points: 400 },
  STREAK_100: { id: 'streak_100', name: 'Streak Legend', desc: '100-day completion streak', tier: 'gold', icon: '🔥', category: 'streaks', rarity: 'legendary', points: 1500 },
  STREAK_365: { id: 'streak_365', name: 'Year Champion', desc: '365-day completion streak', tier: 'platinum', icon: '🔥', category: 'streaks', rarity: 'mythic', points: 5000 },

  // ── SPECIAL / TIME-BASED ──
  PERFECT_WEEK: { id: 'perfect_week', name: 'Perfect Week', desc: 'Complete all tasks for 7 days straight', tier: 'gold', icon: '🏆', category: 'special', rarity: 'rare', points: 500 },
  EARLY_BIRD: { id: 'early_bird', name: 'Early Bird', desc: 'Complete 50 tasks before due time', tier: 'silver', icon: '🌅', category: 'special', rarity: 'uncommon', points: 200 },
  SPEED_DEMON: { id: 'speed_demon', name: 'Speed Demon', desc: 'Complete all tasks before noon on any day', tier: 'gold', icon: '⚡', category: 'special', rarity: 'rare', points: 300 },
  NIGHT_OWL: { id: 'night_owl', name: 'Night Owl', desc: 'Complete 25 tasks after 10 PM', tier: 'bronze', icon: '🦉', category: 'special', rarity: 'uncommon', points: 100 },
  WEEKEND_WARRIOR: { id: 'weekend_warrior', name: 'Weekend Warrior', desc: 'Complete tasks on 20 weekends', tier: 'silver', icon: '🎮', category: 'special', rarity: 'uncommon', points: 250 },

  // ── SOCIAL ACHIEVEMENTS ──
  TEAM_PLAYER: { id: 'team_player', name: 'Team Player', desc: 'Send 500 messages', tier: 'silver', icon: '💬', category: 'social', rarity: 'uncommon', points: 200 },
  CONVERSATIONALIST: { id: 'conversationalist', name: 'Conversationalist', desc: 'Send 1,000 messages', tier: 'gold', icon: '�️', category: 'social', rarity: 'rare', points: 400 },
  HIGH_FIVE_HERO: { id: 'high_five_hero', name: 'High Five Hero', desc: 'Give 100 high-fives', tier: 'bronze', icon: '✋', category: 'social', rarity: 'common', points: 150 },
  MEETING_MASTER: { id: 'meeting_master', name: 'Meeting Master', desc: 'Attend 50 meetings', tier: 'silver', icon: '🎥', category: 'social', rarity: 'uncommon', points: 200 },
  REACTION_KING: { id: 'reaction_king', name: 'Reaction King', desc: 'React to 500 messages', tier: 'bronze', icon: '�', category: 'social', rarity: 'common', points: 100 },

  // ── POINTS ACHIEVEMENTS ──
  POINTS_1000: { id: 'points_1000', name: 'Point Collector', desc: 'Earn 1,000 points', tier: 'bronze', icon: '💰', category: 'points', rarity: 'common', points: 100 },
  POINTS_5000: { id: 'points_5000', name: 'Point Master', desc: 'Earn 5,000 points', tier: 'silver', icon: '💎', category: 'points', rarity: 'uncommon', points: 250 },
  POINTS_10000: { id: 'points_10000', name: 'Point Legend', desc: 'Earn 10,000 points', tier: 'gold', icon: '👑', category: 'points', rarity: 'rare', points: 500 },
  POINTS_50000: { id: 'points_50000', name: 'Point Emperor', desc: 'Earn 50,000 points', tier: 'platinum', icon: '💫', category: 'points', rarity: 'legendary', points: 1000 },

  // ── CONSISTENCY ACHIEVEMENTS ──
  MORNING_ROUTINE: { id: 'morning_routine', name: 'Morning Routine', desc: 'Complete tasks before 9 AM for 30 days', tier: 'silver', icon: '☀️', category: 'consistency', rarity: 'uncommon', points: 300 },
  PERFECT_MONTH: { id: 'perfect_month', name: 'Perfect Month', desc: 'Complete all tasks for an entire month', tier: 'platinum', icon: '📅', category: 'consistency', rarity: 'legendary', points: 1500 },
  ZERO_MISSES: { id: 'zero_misses', name: 'Zero Misses', desc: 'Complete 100 tasks with no late completions', tier: 'gold', icon: '🎯', category: 'consistency', rarity: 'rare', points: 600 },

  // ── HIDDEN / SECRET ACHIEVEMENTS ──
  SECRET_SAUCE: { id: 'secret_sauce', name: '???', desc: 'Complete a task at exactly midnight', tier: 'platinum', icon: '🌙', category: 'hidden', rarity: 'mythic', points: 1000, hidden: true },
  RAINBOW: { id: 'rainbow', name: '???', desc: 'Use all emoji reactions in one day', tier: 'gold', icon: '🌈', category: 'hidden', rarity: 'rare', points: 500, hidden: true },
} as const;

async function ensureAchievementsTable() {
  try {
    await sqlite.execute(`
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
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    await ensureAchievementsTable();

    const unlocked = await sqlite.prepare(
      "SELECT * FROM achievements WHERE location_id = ? ORDER BY unlocked_at DESC"
    ).all(session.id) as any[];

    const unlockedIds = new Set(unlocked.map(a => a.achievement_id));
    
    const all = Object.values(ACHIEVEMENTS).map(achievement => ({
      ...achievement,
      earned: unlockedIds.has(achievement.id),
      earnedDate: unlocked.find(a => a.achievement_id === achievement.id)?.unlocked_at || null,
    }));

    return NextResponse.json({ 
      badges: all, 
      earnedCount: unlocked.length, 
      totalCount: Object.keys(ACHIEVEMENTS).length 
    });
  } catch (error) {
    console.error("Get achievements error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { achievementId } = await request.json();

    await ensureAchievementsTable();

    // Check if already unlocked
    const existing = await sqlite.prepare(
      "SELECT * FROM achievements WHERE location_id = ? AND achievement_id = ?"
    ).get(session.id, achievementId);

    if (existing) {
      return NextResponse.json({ alreadyUnlocked: true });
    }

    // Unlock achievement
    await sqlite.prepare(`
      INSERT INTO achievements (id, location_id, achievement_id, unlocked_at, notified)
      VALUES (?, ?, ?, ?, 1)
    `).run(uuid(), session.id, achievementId, new Date().toISOString());

    const achievement = Object.values(ACHIEVEMENTS).find(a => a.id === achievementId);

    // Create real-time notification for achievement unlock
    if (achievement) {
      await createNotification({
        userId: session.id,
        userType: "location",
        type: "achievement_unlocked",
        title: `Achievement Unlocked: ${achievement.name}! 🎉`,
        message: `${achievement.desc} - +${achievement.points} points`,
        actionUrl: "/dashboard",
        actionLabel: "View Achievements",
        priority: "normal",
        metadata: {
          achievementId,
          achievementName: achievement.name,
          points: achievement.points,
          rarity: achievement.rarity,
        },
      });
    }

    return NextResponse.json({ unlocked: true, achievement });
  } catch (error) {
    console.error("Unlock achievement error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
