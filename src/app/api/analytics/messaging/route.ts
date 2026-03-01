import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { getAuthSession, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { sqlite } from "@/lib/db";

export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.ANALYTICS_ACCESS);
    if (denied) return denied;

    const startDate = req.nextUrl.searchParams.get("startDate");
    const endDate = req.nextUrl.searchParams.get("endDate");

    // Messages by date
    let messagesByDateQuery = `
      SELECT 
        DATE(created_at) as date,
        COUNT(*) as count,
        COUNT(DISTINCT sender_id) as uniqueSenders
      FROM messages
      WHERE 1=1
    `;
    const dateParams: any[] = [];

    if (startDate) {
      messagesByDateQuery += ` AND DATE(created_at) >= ?`;
      dateParams.push(startDate);
    }
    if (endDate) {
      messagesByDateQuery += ` AND DATE(created_at) <= ?`;
      dateParams.push(endDate);
    }

    messagesByDateQuery += ` GROUP BY DATE(created_at) ORDER BY date DESC`;

    const messagesByDate = sqlite.prepare(messagesByDateQuery).all(...dateParams);

    // Top senders
    let topSendersQuery = `
      SELECT 
        sender_id as senderId,
        sender_type as senderType,
        sender_name as senderName,
        COUNT(*) as messageCount
      FROM messages
      WHERE 1=1
    `;
    const senderParams: any[] = [];

    if (startDate) {
      topSendersQuery += ` AND DATE(created_at) >= ?`;
      senderParams.push(startDate);
    }
    if (endDate) {
      topSendersQuery += ` AND DATE(created_at) <= ?`;
      senderParams.push(endDate);
    }

    topSendersQuery += ` GROUP BY sender_id, sender_type, sender_name ORDER BY messageCount DESC LIMIT 20`;

    const topSenders = sqlite.prepare(topSendersQuery).all(...senderParams);

    // Peak messaging hours
    let hourlyQuery = `
      SELECT 
        CAST(strftime('%H', created_at) AS INTEGER) as hour,
        COUNT(*) as count
      FROM messages
      WHERE 1=1
    `;
    const hourlyParams: any[] = [];

    if (startDate) {
      hourlyQuery += ` AND DATE(created_at) >= ?`;
      hourlyParams.push(startDate);
    }
    if (endDate) {
      hourlyQuery += ` AND DATE(created_at) <= ?`;
      hourlyParams.push(endDate);
    }

    hourlyQuery += ` GROUP BY hour ORDER BY hour`;

    const hourlyPattern = sqlite.prepare(hourlyQuery).all(...hourlyParams);

    // Summary
    let summaryQuery = `
      SELECT 
        COUNT(*) as totalMessages,
        COUNT(DISTINCT sender_id) as uniqueSenders,
        COUNT(DISTINCT conversation_id) as activeConversations
      FROM messages
      WHERE 1=1
    `;
    const summaryParams: any[] = [];

    if (startDate) {
      summaryQuery += ` AND DATE(created_at) >= ?`;
      summaryParams.push(startDate);
    }
    if (endDate) {
      summaryQuery += ` AND DATE(created_at) <= ?`;
      summaryParams.push(endDate);
    }

    const summary = sqlite.prepare(summaryQuery).get(...summaryParams);

    return NextResponse.json({
      messagesByDate,
      topSenders,
      hourlyPattern,
      summary,
    });
  } catch (error) {
    console.error("Messaging analytics error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
