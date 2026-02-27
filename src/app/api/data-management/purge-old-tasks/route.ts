import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }

    // Delete task completions older than 90 days
    const ninetyDaysAgo = new Date();
    ninetyDaysAgo.setDate(ninetyDaysAgo.getDate() - 90);
    const cutoffDate = ninetyDaysAgo.toISOString().split("T")[0];

    const result = sqlite.prepare(
      "DELETE FROM task_completions WHERE completed_date < ?"
    ).run(cutoffDate);

    return NextResponse.json({
      success: true,
      deletedCompletions: result.changes,
      cutoffDate,
    });
  } catch (error) {
    console.error("Purge old tasks error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
