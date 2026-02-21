import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - ARL access required" }, { status: 401 });
    }

    // Delete all task completions to reset the leaderboard
    const result = sqlite.prepare("DELETE FROM task_completions").run();

    return NextResponse.json({
      success: true,
      deletedCompletions: result.changes,
    });
  } catch (error) {
    console.error("Reset leaderboard error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
