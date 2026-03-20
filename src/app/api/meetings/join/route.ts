import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";
import { findActiveMeetingByCode } from "@/lib/socket-server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// POST - Validate meeting code + password for guest access
export async function POST(req: NextRequest) {
  try {
    const { meetingCode, password, guestName } = await req.json();

    if (!meetingCode || !guestName) {
      return ApiErrors.badRequest("Meeting code and name are required");
    }

    const code = meetingCode.toUpperCase().trim();

    // First check the scheduled_meetings DB table
    const meeting = sqlite.prepare(
      "SELECT * FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1"
    ).get(code) as any;

    if (meeting) {
      if (!meeting.allow_guests) {
        return ApiErrors.forbidden("This meeting does not allow guest access");
      }

      if (meeting.password && meeting.password !== password) {
        return ApiErrors.unauthorized();
      }

      // Check if the meeting is already live (host has started it)
      const liveCheck = findActiveMeetingByCode(code);

      return apiSuccess({
        success: true,
        meeting: {
          id: meeting.id,
          meetingCode: meeting.meeting_code,
          title: meeting.title,
          hostName: meeting.host_name,
          hostId: meeting.host_id,
          scheduledAt: meeting.scheduled_at,
          durationMinutes: meeting.duration_minutes,
          hasPassword: !!meeting.password,
          isLive: !!liveCheck,
        },
      });
    }

    // Not in DB — check in-memory active meetings (on-demand meetings created via BroadcastStudio)
    const activeMeeting = findActiveMeetingByCode(code);
    if (activeMeeting) {
      if (activeMeeting.password && activeMeeting.password !== password) {
        return ApiErrors.unauthorized();
      }

      return apiSuccess({
        success: true,
        meeting: {
          id: activeMeeting.meetingId,
          meetingCode: code,
          title: activeMeeting.title,
          hostName: activeMeeting.hostName,
          hostId: activeMeeting.hostId,
          scheduledAt: new Date().toISOString(),
          durationMinutes: 60,
          hasPassword: !!activeMeeting.password,
          isLive: true,
        },
      });
    }

    return ApiErrors.notFound("Meeting not found or inactive");
  } catch (error) {
    console.error("Join meeting error:", error);
    return ApiErrors.internal();
  }
}
