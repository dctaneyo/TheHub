import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import fs from "fs";
import path from "path";

export async function POST() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    const dbPath = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
    const sizeBefore = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;

    sqlite.exec("VACUUM");
    sqlite.exec("ANALYZE");

    const sizeAfter = fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0;
    const saved = sizeBefore - sizeAfter;

    return NextResponse.json({
      success: true,
      sizeBefore,
      sizeAfter,
      saved,
      sizeBeforeFormatted: formatBytes(sizeBefore),
      sizeAfterFormatted: formatBytes(sizeAfter),
      savedFormatted: formatBytes(Math.max(0, saved)),
    });
  } catch (error) {
    console.error("Vacuum error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
}
