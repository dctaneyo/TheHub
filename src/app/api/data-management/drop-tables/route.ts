import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const { tables } = await req.json();
    if (!Array.isArray(tables) || tables.length === 0) {
      return NextResponse.json({ error: "No tables specified" }, { status: 400 });
    }

    // Safety: only allow dropping known unused tables
    const ALLOWED_DROPS = new Set([
      "onboarding_custom_forms",
      "onboarding_sessions",
      "onboarding_submissions",
    ]);

    const dropped: string[] = [];
    const skipped: string[] = [];

    for (const table of tables) {
      if (!ALLOWED_DROPS.has(table)) {
        skipped.push(table);
        continue;
      }
      try {
        sqlite.prepare(`DROP TABLE IF EXISTS "${table}"`).run();
        dropped.push(table);
      } catch (err) {
        skipped.push(table);
      }
    }

    return NextResponse.json({
      success: true,
      dropped,
      skipped,
      message: `Dropped ${dropped.length} table(s)${skipped.length > 0 ? `, skipped ${skipped.length}` : ""}`,
    });
  } catch (error) {
    console.error("Drop tables error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
