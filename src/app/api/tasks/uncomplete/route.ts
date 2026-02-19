import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const { taskId, completedDate: requestedDate } = await req.json();
    if (!taskId) return NextResponse.json({ error: "taskId required" }, { status: 400 });

    const targetDate = requestedDate || new Date().toISOString().split("T")[0];

    const completion = db
      .select()
      .from(schema.taskCompletions)
      .where(
        and(
          eq(schema.taskCompletions.taskId, taskId),
          eq(schema.taskCompletions.locationId, session.id),
          eq(schema.taskCompletions.completedDate, targetDate)
        )
      )
      .get();

    if (!completion) {
      return NextResponse.json({ error: "No completion found for this date" }, { status: 404 });
    }

    db.delete(schema.taskCompletions)
      .where(eq(schema.taskCompletions.id, completion.id))
      .run();

    return NextResponse.json({ success: true, pointsRevoked: completion.pointsEarned });
  } catch (error) {
    console.error("Uncomplete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
