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

    const { taskId, notes } = await req.json();

    const task = db.select().from(schema.tasks).where(eq(schema.tasks.id, taskId)).get();
    if (!task) {
      return NextResponse.json({ error: "Task not found" }, { status: 404 });
    }

    const todayStr = new Date().toISOString().split("T")[0];

    const completion = {
      id: uuid(),
      taskId,
      locationId: session.id,
      completedAt: new Date().toISOString(),
      completedDate: todayStr,
      notes: notes || null,
      pointsEarned: task.points,
    };

    db.insert(schema.taskCompletions).values(completion).run();

    return NextResponse.json({
      success: true,
      pointsEarned: task.points,
      completion,
    });
  } catch (error) {
    console.error("Complete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
