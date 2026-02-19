import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and, gt } from "drizzle-orm";
import { v4 as uuid } from "uuid";

function genCode(): string {
  return String(Math.floor(100000 + Math.random() * 900000));
}

// POST - Create a new pending session (called by login page on load, no auth required)
export async function POST(req: NextRequest) {
  try {
    const ua = req.headers.get("user-agent") || "";
    const now = new Date();
    const expiresAt = new Date(now.getTime() + 15 * 60 * 1000).toISOString(); // 15 min

    // Generate unique code
    let code = genCode();
    let attempts = 0;
    while (attempts < 10) {
      const existing = db
        .select()
        .from(schema.pendingSessions)
        .where(
          and(
            eq(schema.pendingSessions.code, code),
            eq(schema.pendingSessions.status, "pending")
          )
        )
        .get();
      if (!existing) break;
      code = genCode();
      attempts++;
    }

    const pending = {
      id: uuid(),
      code,
      status: "pending",
      userAgent: ua,
      createdAt: now.toISOString(),
      expiresAt,
    };

    db.insert(schema.pendingSessions).values(pending).run();

    return NextResponse.json({ id: pending.id, code: pending.code, expiresAt });
  } catch (error) {
    console.error("Create pending session error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET - List all active pending sessions (ARL only)
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }

    const now = new Date().toISOString();

    // Get pending sessions that haven't expired
    const pending = db
      .select()
      .from(schema.pendingSessions)
      .where(
        and(
          eq(schema.pendingSessions.status, "pending"),
          gt(schema.pendingSessions.expiresAt, now)
        )
      )
      .all();

    return NextResponse.json({
      pendingSessions: pending.map((p) => ({
        id: p.id,
        code: p.code,
        userAgent: p.userAgent,
        createdAt: p.createdAt,
        expiresAt: p.expiresAt,
      })),
    });
  } catch (error) {
    console.error("List pending sessions error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
