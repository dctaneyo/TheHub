import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    // Points leaderboard
    let leaderboardQuery = `
      SELECT 
        tc.location_id as locationId,
        l.name as locationName,
        COALESCE(SUM(tc.points_earned + tc.bonus_points), 0) as totalPoints,
        COUNT(*) as tasksCompleted,
        COALESCE(SUM(tc.bonus_points), 0) as totalBonus
      FROM task_completions tc
      LEFT JOIN locations l ON l.id = tc.location_id
      WHERE 1=1
    `;
    const leaderParams: any[] = [];

    if (startDate) {
      leaderboardQuery += ` AND tc.completed_date >= ?`;
      leaderParams.push(startDate);
    }
    if (endDate) {
      leaderboardQuery += ` AND tc.completed_date <= ?`;
      leaderParams.push(endDate);
    }

    leaderboardQuery += ` GROUP BY tc.location_id ORDER BY totalPoints DESC LIMIT 20`;

    const pointsLeaderboard = sqlite.prepare(leaderboardQuery).all(...leaderParams);

    // Achievement unlock trends (if table exists)
    let achievementTrends: any[] = [];
    let popularAchievements: any[] = [];
    let locationAchievements: any[] = [];

    try {
      let trendQuery = `
        SELECT 
          DATE(unlocked_at) as date,
          COUNT(*) as count,
          COUNT(DISTINCT location_id) as uniqueLocations
        FROM achievements
        WHERE 1=1
      `;
      const trendParams: any[] = [];

      if (startDate) {
        trendQuery += ` AND DATE(unlocked_at) >= ?`;
        trendParams.push(startDate);
      }
      if (endDate) {
        trendQuery += ` AND DATE(unlocked_at) <= ?`;
        trendParams.push(endDate);
      }

      trendQuery += ` GROUP BY DATE(unlocked_at) ORDER BY date DESC`;

      achievementTrends = sqlite.prepare(trendQuery).all(...trendParams);

      popularAchievements = sqlite.prepare(`
        SELECT 
          achievement_id as achievementId,
          COUNT(*) as unlockCount,
          COUNT(DISTINCT location_id) as uniqueEarners
        FROM achievements
        GROUP BY achievement_id
        ORDER BY unlockCount DESC
      `).all();

      locationAchievements = sqlite.prepare(`
        SELECT 
          location_id as locationId,
          COUNT(*) as totalAchievements,
          COUNT(DISTINCT achievement_id) as uniqueAchievements
        FROM achievements
        GROUP BY location_id
        ORDER BY totalAchievements DESC
      `).all();
    } catch {
      // achievements table might not exist yet
    }

    return NextResponse.json({
      pointsLeaderboard,
      achievementTrends,
      popularAchievements,
      locationAchievements,
    });
  } catch (error) {
    console.error("Gamification analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
