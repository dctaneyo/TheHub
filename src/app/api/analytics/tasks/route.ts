import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");
    const locationId = req.nextUrl.searchParams.get("locationId");

    // Completion trends by date
    let completionsByDateQuery = `
      SELECT 
        completed_date as date,
        COUNT(*) as count,
        COALESCE(SUM(points_earned), 0) as totalPoints,
        COALESCE(SUM(bonus_points), 0) as bonusPoints
      FROM task_completions
      WHERE 1=1
    `;
    const params: any[] = [];

    if (startDate) {
      completionsByDateQuery += ` AND completed_date >= ?`;
      params.push(startDate);
    }
    if (endDate) {
      completionsByDateQuery += ` AND completed_date <= ?`;
      params.push(endDate);
    }
    if (locationId) {
      completionsByDateQuery += ` AND location_id = ?`;
      params.push(locationId);
    }

    completionsByDateQuery += ` GROUP BY completed_date ORDER BY completed_date DESC`;

    const completionsByDate = sqlite.prepare(completionsByDateQuery).all(...params);

    // Top performing locations
    let topLocationsQuery = `
      SELECT 
        tc.location_id as locationId,
        l.name as locationName,
        COUNT(*) as completions,
        COALESCE(SUM(tc.points_earned), 0) as totalPoints
      FROM task_completions tc
      LEFT JOIN locations l ON l.id = tc.location_id
      WHERE 1=1
    `;
    const topParams: any[] = [];

    if (startDate) {
      topLocationsQuery += ` AND tc.completed_date >= ?`;
      topParams.push(startDate);
    }
    if (endDate) {
      topLocationsQuery += ` AND tc.completed_date <= ?`;
      topParams.push(endDate);
    }

    topLocationsQuery += ` GROUP BY tc.location_id ORDER BY completions DESC LIMIT 10`;

    const topLocations = sqlite.prepare(topLocationsQuery).all(...topParams);

    // Time-of-day pattern
    let timeQuery = `
      SELECT 
        CAST(strftime('%H', completed_at) AS INTEGER) as hour,
        COUNT(*) as count
      FROM task_completions
      WHERE 1=1
    `;
    const timeParams: any[] = [];

    if (startDate) {
      timeQuery += ` AND completed_date >= ?`;
      timeParams.push(startDate);
    }
    if (endDate) {
      timeQuery += ` AND completed_date <= ?`;
      timeParams.push(endDate);
    }

    timeQuery += ` GROUP BY hour ORDER BY hour`;

    const timeOfDayPattern = sqlite.prepare(timeQuery).all(...timeParams);

    // Task performance (which tasks are completed most)
    let taskPerfQuery = `
      SELECT 
        tc.task_id as taskId,
        t.title as taskTitle,
        COUNT(*) as completions,
        COUNT(DISTINCT tc.location_id) as uniqueLocations,
        ROUND(AVG(tc.points_earned), 1) as avgPoints
      FROM task_completions tc
      LEFT JOIN tasks t ON t.id = tc.task_id
      WHERE 1=1
    `;
    const taskPerfParams: any[] = [];

    if (startDate) {
      taskPerfQuery += ` AND tc.completed_date >= ?`;
      taskPerfParams.push(startDate);
    }
    if (endDate) {
      taskPerfQuery += ` AND tc.completed_date <= ?`;
      taskPerfParams.push(endDate);
    }

    taskPerfQuery += ` GROUP BY tc.task_id ORDER BY completions DESC LIMIT 20`;

    const taskPerformance = sqlite.prepare(taskPerfQuery).all(...taskPerfParams);

    // Summary stats
    let summaryQuery = `
      SELECT 
        COUNT(*) as totalCompletions,
        COALESCE(SUM(points_earned), 0) as totalPoints,
        COALESCE(SUM(bonus_points), 0) as totalBonusPoints,
        COUNT(DISTINCT location_id) as activeLocations,
        COUNT(DISTINCT task_id) as uniqueTasks
      FROM task_completions
      WHERE 1=1
    `;
    const summaryParams: any[] = [];

    if (startDate) {
      summaryQuery += ` AND completed_date >= ?`;
      summaryParams.push(startDate);
    }
    if (endDate) {
      summaryQuery += ` AND completed_date <= ?`;
      summaryParams.push(endDate);
    }

    const summary = sqlite.prepare(summaryQuery).get(...summaryParams);

    return NextResponse.json({
      completionsByDate,
      topLocations,
      timeOfDayPattern,
      taskPerformance,
      summary,
    });
  } catch (error) {
    console.error("Task analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
