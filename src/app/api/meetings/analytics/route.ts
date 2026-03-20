import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { desc, eq, sql } from "drizzle-orm";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// GET /api/meetings/analytics — list all meeting analytics (ARL only)
// GET /api/meetings/analytics?meetingId=xxx — get single meeting detail
export async function GET(req: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.userType !== "arl") {
    return ApiErrors.unauthorized();
  }

  const analyticsId = req.nextUrl.searchParams.get("id");
  const meetingId = req.nextUrl.searchParams.get("meetingId");

  if (analyticsId || meetingId) {
    // Single meeting detail with participants
    // Prefer unique analytics record ID; fall back to meetingId for backwards compat
    const meeting = analyticsId
      ? db.select().from(schema.meetingAnalytics).where(eq(schema.meetingAnalytics.id, analyticsId)).get()
      : db.select().from(schema.meetingAnalytics).where(eq(schema.meetingAnalytics.meetingId, meetingId!)).get();

    if (!meeting) {
      return ApiErrors.notFound("Meeting");
    }

    // Use the specific analytics record's meetingId + startedAt to scope participants
    // This avoids mixing data from different meetings with the same meetingId
    const allParticipants = db
      .select()
      .from(schema.meetingParticipants)
      .where(eq(schema.meetingParticipants.meetingId, meeting.meetingId))
      .all();

    // Filter participants to only those who joined during this specific meeting session
    const meetingStart = new Date(meeting.startedAt).getTime();
    const meetingEnd = meeting.endedAt ? new Date(meeting.endedAt).getTime() + 60_000 : Date.now() + 86400_000;
    const participants = allParticipants.filter(p => {
      const joinedAt = new Date(p.joinedAt).getTime();
      return joinedAt >= meetingStart - 60_000 && joinedAt <= meetingEnd;
    });

    return apiSuccess({ meeting, participants });
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

  return apiSuccess({
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

// DELETE /api/meetings/analytics — delete all meeting analytics data (ARL only)
export async function DELETE(req: NextRequest) {
  const session = await getAuthSession();
  if (!session || session.userType !== "arl") {
    return ApiErrors.unauthorized();
  }

  try {
    // Delete all meeting participants
    db.delete(schema.meetingParticipants).run();
    
    // Delete all meeting analytics
    db.delete(schema.meetingAnalytics).run();

    return apiSuccess({ success: true, message: "All meeting data deleted" });
  } catch (error) {
    console.error("Failed to delete meeting analytics:", error);
    return ApiErrors.internal("Failed to delete meeting data");
  }
}
