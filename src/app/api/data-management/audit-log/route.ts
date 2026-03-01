import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";

// Create audit log table
function ensureAuditTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        user_name TEXT NOT NULL,
        action TEXT NOT NULL,
        details TEXT,
        ip_address TEXT,
        created_at TEXT NOT NULL
      )
    `);
  } catch {}
}

// Log an action
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    ensureAuditTable();

    const { action, details } = await request.json();
    const ip = request.headers.get("x-forwarded-for") || request.headers.get("x-real-ip") || "unknown";

    sqlite.prepare(`
      INSERT INTO audit_log (id, user_id, user_type, user_name, action, details, ip_address, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      session.id,
      session.userType,
      session.name || "Unknown",
      action,
      details || null,
      ip,
      new Date().toISOString()
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Audit log error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// Get audit logs
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.DATA_MANAGEMENT_ACCESS);
    if (denied) return denied;

    ensureAuditTable();

    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get("limit") || "100");
    const action = searchParams.get("action");
    const userId = searchParams.get("userId");

    let query = "SELECT * FROM audit_log";
    const conditions: string[] = [];
    const params: any[] = [];

    if (action) {
      conditions.push("action = ?");
      params.push(action);
    }
    if (userId) {
      conditions.push("user_id = ?");
      params.push(userId);
    }

    if (conditions.length > 0) {
      query += " WHERE " + conditions.join(" AND ");
    }

    query += " ORDER BY created_at DESC LIMIT ?";
    params.push(limit);

    const logs = sqlite.prepare(query).all(...params);

    return NextResponse.json({ logs });
  } catch (error) {
    console.error("Get audit logs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
