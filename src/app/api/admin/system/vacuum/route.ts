import { sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";

// Moved from /api/data-management/vacuum — whole-database-file operation,
// never tenant-scoped (a single tenant triggering this affects every other
// tenant sharing the database). PIN re-confirmation required.
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { pin } = await req.json();
    if (!pin) return ApiErrors.badRequest("PIN required");
    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, pin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

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
