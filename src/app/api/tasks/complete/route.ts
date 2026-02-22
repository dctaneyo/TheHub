import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { broadcastTaskCompleted, broadcastLeaderboardUpdate } from "@/lib/socket-emit";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { taskId, notes, completedDate: requestedDate, localDate } = await req.json();

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    // Prefer client-supplied localDate (avoids UTC vs local timezone mismatch on Railway).
    // Fall back to requestedDate (early-complete from calendar), then server UTC.
    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = requestedDate || localDate || todayStr;

    // If completing for a future date, check allowEarlyComplete
    if (targetDate > todayStr && !task.allowEarlyComplete) {
      return NextResponse.json({ error: "This task cannot be completed early" }, { status: 403 });
    }

    // Early bird bonus: +25% when completing ahead of due date
    const isEarly = targetDate > todayStr;
    const bonusPoints = isEarly ? Math.round(task.points * 0.25) : 0;

    const completion = {
      id: uuid(),
      taskId,
      locationId: session.id,
      completedAt: new Date().toISOString(),
      completedDate: targetDate,
      notes: notes || null,
      pointsEarned: task.points,
      bonusPoints,
    };

    db.insert(schema.taskCompletions).values(completion).run();

    // Broadcast instant update via WebSocket
    broadcastTaskCompleted(session.id, taskId, task.title, task.points + bonusPoints, session.name);
    broadcastLeaderboardUpdate(session.id);

    return NextResponse.json({
      success: true,
      pointsEarned: task.points,
      bonusPoints,
      totalPoints: task.points + bonusPoints,
      isEarly,
      completion,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
