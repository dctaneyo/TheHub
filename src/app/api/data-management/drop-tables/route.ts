import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function POST(req: Request) {
  try {
    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const { tables } = await req.json();
    if (!Array.isArray(tables) || tables.length === 0) {
      return ApiErrors.badRequest("No tables specified");
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

    return apiSuccess({
      dropped,
      skipped,
      message: `Dropped ${dropped.length} table(s)${skipped.length > 0 ? `, skipped ${skipped.length}` : ""}`,
    });
  } catch (error) {
    console.error("Drop tables error:", error);
    return ApiErrors.internal();
  }
}
