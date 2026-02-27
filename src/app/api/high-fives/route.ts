import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { sqlite } from "@/lib/db";
import { v4 as uuid } from "uuid";
import { broadcastToAll } from "@/lib/socket-emit";

// Ensure high_fives table exists
function ensureHighFivesTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS high_fives (
        id TEXT PRIMARY KEY,
        from_user_id TEXT NOT NULL,
        from_user_type TEXT NOT NULL,
        from_user_name TEXT NOT NULL,
        to_user_id TEXT NOT NULL,
        to_user_type TEXT NOT NULL,
        to_user_name TEXT NOT NULL,
        message TEXT,
        created_at TEXT NOT NULL
      )
    `);
  } catch {}
}

// GET - Fetch high-fives for a user
export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    ensureHighFivesTable();

    const { searchParams } = new URL(request.url);
    const userId = searchParams.get("userId") || session.id;
    const userType = searchParams.get("userType") || session.userType;

    // Get high-fives received
    const received = sqlite.prepare(`
      SELECT * FROM high_fives 
      WHERE to_user_id = ? AND to_user_type = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId, userType) as any[];

    // Get high-fives sent
    const sent = sqlite.prepare(`
      SELECT * FROM high_fives 
      WHERE from_user_id = ? AND from_user_type = ?
      ORDER BY created_at DESC
      LIMIT 50
    `).all(userId, userType) as any[];

    // Get total count
    const totalReceived = sqlite.prepare(`
      SELECT COUNT(*) as count FROM high_fives 
      WHERE to_user_id = ? AND to_user_type = ?
    `).get(userId, userType) as any;

    return NextResponse.json({ 
      received, 
      sent,
      totalReceived: totalReceived.count 
    });
  } catch (error) {
    console.error("Get high-fives error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST - Send a high-five
export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const { toUserId, toUserType, toUserName, message } = await request.json();

    if (!toUserId || !toUserType || !toUserName) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }

    ensureHighFivesTable();

    const highFiveId = uuid();
    const now = new Date().toISOString();

    sqlite.prepare(`
      INSERT INTO high_fives (
        id, from_user_id, from_user_type, from_user_name,
        to_user_id, to_user_type, to_user_name, message, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      highFiveId,
      session.id,
      session.userType,
      session.name,
      toUserId,
      toUserType,
      toUserName,
      message || null,
      now
    );

    const highFive = {
      id: highFiveId,
      from_user_id: session.id,
      from_user_type: session.userType,
      from_user_name: session.name,
      to_user_id: toUserId,
      to_user_type: toUserType,
      to_user_name: toUserName,
      message,
      created_at: now,
    };

    // Broadcast to recipient and all users
    broadcastToAll("high-five:received", highFive);

    return NextResponse.json({ highFive });
  } catch (error) {
    console.error("Send high-five error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
