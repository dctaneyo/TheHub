import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST(request: Request) {
  try {
    const ip = getClientIP(request.headers);
    const rl = checkRateLimit(`data-management:${ip}`, { maxAttempts: 10, windowMs: 60_000, lockoutMs: 5 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const session = await getAuthSession();
    if (!session) return ApiErrors.unauthorized();
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
    const sizeBefore = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    sqlite.exec("VACUUM");
    sqlite.exec("ANALYZE");

    const sizeAfter = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const saved = sizeBefore - sizeAfter;

    return apiSuccess({
      sizeBefore,
      sizeAfter,
      saved,
      sizeBeforeFormatted: formatBytes(sizeBefore),
      sizeAfterFormatted: formatBytes(sizeAfter),
      savedFormatted: formatBytes(Math.max(0, saved)),
    });
  } catch (error) {
    console.error("Vacuum error:", error);
    return ApiErrors.internal();
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
