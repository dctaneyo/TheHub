import { NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, sqlite } from "@/lib/db";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

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
