import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { broadcastTaskUpdate, broadcastTaskUncompleted, broadcastLeaderboardUpdate } from "@/lib/socket-emit";
import { refreshTaskTimers } from "@/lib/task-notification-scheduler";
import { validate, uncompleteTaskSchema } from "@/lib/validations";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const body = await req.json();
    const parsed = validate(uncompleteTaskSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { taskId, completedDate: requestedDate, localDate } = parsed.data;

    const targetDate = requestedDate || localDate || new Date().toISOString().split("T")[0];

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

    broadcastTaskUpdate(session.id, session.tenantId);
    broadcastTaskUncompleted(session.id, taskId, session.tenantId);
    broadcastLeaderboardUpdate(session.id, session.tenantId);
    refreshTaskTimers();

    return NextResponse.json({ success: true, pointsRevoked: completion.pointsEarned });
  } catch (error) {
    console.error("Uncomplete task error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
