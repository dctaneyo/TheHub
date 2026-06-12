import { NextRequest } from "next/server";
import { sqlite } from "@/lib/db";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { findActiveMeetingByCode } from "@/lib/socket-server";
import { createMeetingInvite } from "@/lib/meeting-invite";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const JOIN_BASE_URL = "https://join.meetthehub.com";

// Create a secure one-click invite link for a meeting. ARL only.
// The returned URL carries an opaque token — never the meeting password.
export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl") {
      return ApiErrors.forbidden("Only ARLs can create invite links");
    }

    const body = await req.json();
    const meetingCode =
      typeof body?.meetingCode === "string" ? body.meetingCode.toUpperCase().trim() : "";
    if (!meetingCode) {
      return ApiErrors.badRequest("Meeting code required");
    }

    // Expiry: null/0 = never expires (reusable); otherwise hours.
    const rawHours = Number(body?.expiresInHours);
    const expiresInHours =
      Number.isFinite(rawHours) && rawHours > 0 ? Math.min(rawHours, 24 * 30) : null;

    // Verify the meeting exists (scheduled or on-demand).
    const scheduled = sqlite
      .prepare("SELECT meeting_code FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1")
      .get(meetingCode) as { meeting_code?: string } | undefined;
    const exists = !!scheduled || !!findActiveMeetingByCode(meetingCode);
    if (!exists) {
      return ApiErrors.notFound("Meeting");
    }

    const { token, expiresAt } = createMeetingInvite({
      meetingCode,
      tenantId: session.tenantId,
      createdBy: session.id,
      expiresInHours,
    });

    return apiSuccess({
      token,
      url: `${JOIN_BASE_URL}?invite=${token}`,
      expiresAt,
    });
  } catch (error) {
    console.error("Create meeting invite error:", error);
    return ApiErrors.internal();
  }
}
