import fs from "fs";
import path from "path";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";

const BACKUP_DIR = "./data/backups";

// GET — passive backup-health signal (last-mtime-per-type), shown as a
// small ambient strip on the tenants list. No action attached — see the
// plan's Layout Intent section for why this is split from the active
// system-maintenance actions (vacuum/drop-tables/orphaned-cleanup), which
// live under /admin/team instead.
export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const types: Array<"daily" | "weekly" | "monthly"> = ["daily", "weekly", "monthly"];
    const lastByType: Record<string, string | null> = { daily: null, weekly: null, monthly: null };

    if (fs.existsSync(BACKUP_DIR)) {
      const files = fs.readdirSync(BACKUP_DIR);
      for (const type of types) {
        let latestMtime = 0;
        for (const file of files) {
          if (!file.includes(`-${type}-`)) continue;
          const stat = fs.statSync(path.join(BACKUP_DIR, file));
          if (stat.mtimeMs > latestMtime) {
            latestMtime = stat.mtimeMs;
            lastByType[type] = stat.mtime.toISOString();
          }
        }
      }
    }

    return apiSuccess({ lastByType });
  } catch (error) {
    console.error("Backup health error:", error);
    return ApiErrors.internal();
  }
}
