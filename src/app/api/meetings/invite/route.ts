import { NextRequest } from "next/server";
import { sqlite } from "@/lib/db";
import { findActiveMeetingByCode } from "@/lib/socket-server";
import { inviteStatus } from "@/lib/meeting-invite";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Public: resolve a one-click invite token to its meeting (no password exposed).
// Used by the join page to validate the link and prefill the meeting.
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`invite-resolve:${ip}`, {
      maxAttempts: 30,
      windowMs: 60_000,
      lockoutMs: 60_000,
    });
    if (!rl.allowed) return ApiErrors.tooManyRequests(60);

    const token = (new URL(req.url).searchParams.get("token") || "").trim();
    if (!token) return ApiErrors.badRequest("Invite token required");

    const st = inviteStatus(token);
    if (!st.meetingCode) {
      return apiSuccess({ valid: false, found: false, expired: false });
    }
    if (!st.valid) {
      return apiSuccess({
        valid: false,
        found: true,
        expired: st.expired,
        meetingCode: st.meetingCode,
      });
    }

    const code = st.meetingCode;
    const meeting = sqlite
      .prepare("SELECT title, allow_guests FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1")
      .get(code) as { title?: string; allow_guests?: number } | undefined;
    if (meeting) {
      return apiSuccess({
        valid: true,
        found: true,
        meetingCode: code,
        title: meeting.title ?? null,
        allowGuests: !!meeting.allow_guests,
      });
    }

    const active = findActiveMeetingByCode(code);
    if (active) {
      return apiSuccess({
        valid: true,
        found: true,
        meetingCode: code,
        title: active.title ?? null,
        allowGuests: true,
      });
    }

    // Invite valid but the meeting no longer exists.
    return apiSuccess({ valid: false, found: false, meetingCode: code });
  } catch (error) {
    console.error("Resolve meeting invite error:", error);
    return ApiErrors.internal();
  }
}
