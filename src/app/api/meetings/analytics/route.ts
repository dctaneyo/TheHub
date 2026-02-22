import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// GET /api/meetings/analytics — list all meeting analytics (ARL only)
// GET /api/meetings/analytics?meetingId=xxx — get single meeting detail
export async function GET(req: NextRequest) {
  const session = await getSession();
  if (!session || session.userType !== "arl") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const meetingId = req.nextUrl.searchParams.get("meetingId");

  if (meetingId) {
    // Single meeting detail with participants
    const meeting = db
      .select()
      .from(schema.meetingAnalytics)
      .where(eq(schema.meetingAnalytics.meetingId, meetingId))
      .get();

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    const participants = db
      .select()
      .from(schema.meetingParticipants)
      .where(eq(schema.meetingParticipants.meetingId, meetingId))
      .all();

    return NextResponse.json({ meeting, participants });
  }

  // List all meetings, most recent first
  const meetings = db
    .select()
    .from(schema.meetingAnalytics)
    .orderBy(desc(schema.meetingAnalytics.startedAt))
    .all();

  // Summary stats
  const totalMeetings = meetings.length;
  const completedMeetings = meetings.filter(m => m.endedAt).length;
  const totalDuration = meetings.reduce((sum, m) => sum + (m.duration || 0), 0);
  const avgDuration = completedMeetings > 0 ? Math.round(totalDuration / completedMeetings) : 0;
  const avgParticipants = totalMeetings > 0
    ? Math.round(meetings.reduce((sum, m) => sum + (m.peakParticipants || 0), 0) / totalMeetings)
    : 0;
  const totalMessages = meetings.reduce((sum, m) => sum + (m.totalMessages || 0), 0);
  const totalReactions = meetings.reduce((sum, m) => sum + (m.totalReactions || 0), 0);
  const totalQuestions = meetings.reduce((sum, m) => sum + (m.totalQuestions || 0), 0);
  const totalHandRaises = meetings.reduce((sum, m) => sum + (m.totalHandRaises || 0), 0);

  return NextResponse.json({
    meetings,
    summary: {
      totalMeetings,
      completedMeetings,
      totalDuration,
      avgDuration,
      avgParticipants,
      totalMessages,
      totalReactions,
      totalQuestions,
      totalHandRaises,
    },
  });
}
