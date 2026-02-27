import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";

function ensureTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS streak_freezes (
        id TEXT PRIMARY KEY,
        location_id TEXT NOT NULL,
        freeze_date TEXT NOT NULL,
        created_at TEXT NOT NULL
      )
    `);
  } catch {}
}

// GET: fetch how many freezes are available and which dates are frozen
export async function GET() {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    ensureTable();

    const freezes = sqlite
      .prepare("SELECT * FROM streak_freezes WHERE location_id = ? ORDER BY freeze_date DESC")
      .all(session.id) as any[];

    // Max 3 freezes per location, reset monthly
    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
    const usedThisMonth = freezes.filter((f) => f.freeze_date.startsWith(thisMonth)).length;
    const available = Math.max(0, 3 - usedThisMonth);
    const frozenDates = new Set(freezes.map((f) => f.freeze_date));

    return NextResponse.json({
      available,
      usedThisMonth,
      maxPerMonth: 3,
      frozenDates: Array.from(frozenDates),
    });
  } catch (error) {
    console.error("Streak freeze GET error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST: apply a streak freeze for a specific date (defaults to yesterday)
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "location") {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    ensureTable();

    const body = await req.json().catch(() => ({}));
    const { date } = body;

    // Default to yesterday if no date provided
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const defaultDate = `${yesterday.getFullYear()}-${String(yesterday.getMonth() + 1).padStart(2, "0")}-${String(yesterday.getDate()).padStart(2, "0")}`;
    const freezeDate = date || defaultDate;

    // Check monthly limit
    const thisMonth = freezeDate.slice(0, 7);
    const usedThisMonth = sqlite
      .prepare("SELECT COUNT(*) as count FROM streak_freezes WHERE location_id = ? AND freeze_date LIKE ?")
      .get(session.id, `${thisMonth}%`) as any;

    if (usedThisMonth.count >= 3) {
      return NextResponse.json({ error: "Monthly freeze limit reached (3 per month)" }, { status: 400 });
    }

    // Check if already frozen
    const existing = sqlite
      .prepare("SELECT id FROM streak_freezes WHERE location_id = ? AND freeze_date = ?")
      .get(session.id, freezeDate);

    if (existing) {
      return NextResponse.json({ error: "Date already frozen" }, { status: 400 });
    }

    const nowStr = now.toISOString();
    sqlite
      .prepare("INSERT INTO streak_freezes (id, location_id, freeze_date, created_at) VALUES (?, ?, ?, ?)")
      .run(uuid(), session.id, freezeDate, nowStr);

    const remaining = Math.max(0, 3 - (usedThisMonth.count + 1));

    return NextResponse.json({
      success: true,
      freezeDate,
      remaining,
    });
  } catch (error) {
    console.error("Streak freeze POST error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
