import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const completions = db
      .select({
        taskId: schema.taskCompletions.taskId,
        completedDate: schema.taskCompletions.completedDate,
      })
      .from(schema.taskCompletions)
      .where(eq(schema.taskCompletions.locationId, session.id))
      .all();

    return NextResponse.json({ completions });
  } catch (error) {
    console.error("Get completions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
