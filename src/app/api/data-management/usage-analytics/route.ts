import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    // Most active locations by task completions
    const topLocations = sqlite.prepare(`
      SELECT 
        l.id,
        l.name,
        l.store_number,
        COUNT(tc.id) as completions,
        SUM(tc.points_earned + tc.bonus_points) as total_points
      FROM locations l
      LEFT JOIN task_completions tc ON tc.location_id = l.id
      GROUP BY l.id
      ORDER BY completions DESC
      LIMIT 10
    `).all();

    // Message activity by user type
    const messageActivity = sqlite.prepare(`
      SELECT 
        sender_type,
        COUNT(*) as count,
        DATE(created_at) as date
      FROM messages
      WHERE created_at >= datetime('now', '-30 days')
      GROUP BY sender_type, DATE(created_at)
      ORDER BY date DESC
    `).all();

    // Peak usage hours
    const peakHours = sqlite.prepare(`
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as activity_count
      FROM messages
      WHERE created_at >= datetime('now', '-7 days')
      GROUP BY hour
      ORDER BY activity_count DESC
      LIMIT 5
    `).all();

    // Task completion trends (last 30 days)
    const completionTrends = sqlite.prepare(`
      SELECT 
        completed_date,
        COUNT(*) as completions,
        SUM(points_earned + bonus_points) as points
      FROM task_completions
      WHERE completed_date >= date('now', '-30 days')
      GROUP BY completed_date
      ORDER BY completed_date DESC
    `).all();

    // Most completed tasks
    const topTasks = sqlite.prepare(`
      SELECT 
        t.id,
        t.title,
        t.type,
        COUNT(tc.id) as completion_count
      FROM tasks t
      LEFT JOIN task_completions tc ON tc.task_id = t.id
      GROUP BY t.id
      ORDER BY completion_count DESC
      LIMIT 10
    `).all();

    // Session statistics
    let sessionStats = { total: 0, online: 0, locations: 0, arls: 0 };
    try {
      const stats = sqlite.prepare(`
        SELECT 
          COUNT(*) as total,
          SUM(CASE WHEN is_online = 1 THEN 1 ELSE 0 END) as online,
          SUM(CASE WHEN user_type = 'location' THEN 1 ELSE 0 END) as locations,
          SUM(CASE WHEN user_type = 'arl' THEN 1 ELSE 0 END) as arls
        FROM sessions
      `).get() as any;
      sessionStats = stats;
    } catch {}

    // Conversation activity
    const conversationStats = sqlite.prepare(`
      SELECT 
        type,
        COUNT(*) as count
      FROM conversations
      GROUP BY type
    `).all();

    return NextResponse.json({
      topLocations,
      messageActivity,
      peakHours,
      completionTrends,
      topTasks,
      sessionStats,
      conversationStats,
      generatedAt: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Usage analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
