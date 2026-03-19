import { NextResponse } from "next/server";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";

export async function POST() {
  try {
    const session = await getAuthSession();
    if (!session) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

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
