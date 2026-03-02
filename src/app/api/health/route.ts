import { NextResponse } from "next/server";

export async function GET() {
  let dbStatus = "unknown";
  try {
    const { sqlite } = await import("@/lib/db");
    const row = sqlite.prepare("SELECT 1 AS ok").get() as { ok: number } | undefined;
    dbStatus = row?.ok === 1 ? "ok" : "error";
  } catch {
    dbStatus = "error";
  }

  const status = dbStatus === "ok" ? "ok" : "degraded";
  return NextResponse.json({
    status,
    db: dbStatus,
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
  }, { status: status === "ok" ? 200 : 503 });
}
