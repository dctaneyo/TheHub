import { sqlite } from "@/lib/db";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";

// GET — cross-tenant, filterable audit log. Uses audit-logger.ts's table
// exclusively (tenant_id, user_id, user_type, operation, entity_type,
// affected_count, payload, status, error_message) — NOT the unrelated,
// differently-shaped audit_log table self-created by the old
// data-management audit-log route. See the plan's "Landmine" section.
export async function GET(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { searchParams } = new URL(req.url);
    const tenantId = searchParams.get("tenantId");
    const operation = searchParams.get("operation");
    const limit = Math.min(parseInt(searchParams.get("limit") || "100", 10), 500);

    const conditions: string[] = [];
    const args: unknown[] = [];
    if (tenantId) { conditions.push("tenant_id = ?"); args.push(tenantId); }
    if (operation) { conditions.push("operation = ?"); args.push(operation); }
    const where = conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const rows = sqlite.prepare(`SELECT * FROM audit_log ${where} ORDER BY created_at DESC LIMIT ?`).all(...args, limit);

    return apiSuccess({ entries: rows });
  } catch (error) {
    console.error("Admin audit log error:", error);
    return ApiErrors.internal();
  }
}
