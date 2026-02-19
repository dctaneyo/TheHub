import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { taskId, notes, completedDate: requestedDate } = await req.json();

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const todayStr = new Date().toISOString().split("T")[0];
    const targetDate = requestedDate || todayStr;

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
