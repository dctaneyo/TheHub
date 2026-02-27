import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    const count = db.select().from(schema.taskCompletions).all().length;
    db.delete(schema.taskCompletions).run();

    return NextResponse.json({
      success: true,
      deletedCompletions: count,
    });
  } catch (error) {
    console.error("Reset leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
