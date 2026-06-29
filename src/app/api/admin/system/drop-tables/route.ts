import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// Moved from /api/data-management/drop-tables — operates on a hardcoded
// allowlist of unused onboarding tables, not tenant data. PIN
// re-confirmation required.
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { tables, pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    if (!Array.isArray(tables) || tables.length === 0) {
      return ApiErrors.badRequest("No tables specified");
    }

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
      } catch {
        skipped.push(table);
      }
    }

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "drop_tables", entityType: "tables", affectedCount: dropped.length, payload: { dropped, skipped }, status: "success" });

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
