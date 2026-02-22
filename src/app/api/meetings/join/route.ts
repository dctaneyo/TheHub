import { NextRequest, NextResponse } from "next/server";
import { sqlite } from "@/lib/db";

// POST - Validate meeting code + password for guest access
export async function POST(req: NextRequest) {
  try {
    const { meetingCode, password, guestName } = await req.json();

    if (!meetingCode || !guestName) {
      return NextResponse.json({ error: "Meeting code and name are required" }, { status: 400 });
    }

    const meeting = sqlite.prepare(
      "SELECT * FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1"
    ).get(meetingCode.toUpperCase().trim()) as any;

    if (!meeting) {
      return NextResponse.json({ error: "Meeting not found or inactive" }, { status: 404 });
    }

    if (!meeting.allow_guests) {
      return NextResponse.json({ error: "This meeting does not allow guest access" }, { status: 403 });
    }

    if (meeting.password && meeting.password !== password) {
      return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
    }

    // Return meeting info for the guest to join
    return NextResponse.json({
      success: true,
      meeting: {
        id: meeting.id,
        meetingCode: meeting.meeting_code,
        title: meeting.title,
        hostName: meeting.host_name,
        scheduledAt: meeting.scheduled_at,
        durationMinutes: meeting.duration_minutes,
        hasPassword: !!meeting.password,
      },
    });
  } catch (error) {
    console.error("Join meeting error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
