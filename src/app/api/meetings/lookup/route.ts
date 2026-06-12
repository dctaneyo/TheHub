import { NextRequest } from "next/server";
import { sqlite } from "@/lib/db";
import { findActiveMeetingByCode } from "@/lib/socket-server";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

// Lightweight, unauthenticated meeting lookup for the join flow.
// Given a meeting code, reports whether it exists and whether it is password
// protected — WITHOUT requiring the password — so the UI can decide whether to
// prompt for a password. (Joining still validates the password server-side.)
export async function GET(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`meeting-lookup:${ip}`, {
      maxAttempts: 30,
      windowMs: 60_000,
      lockoutMs: 60_000,
    });
    if (!rl.allowed) {
      return ApiErrors.tooManyRequests(60);
    }

    const { searchParams } = new URL(req.url);
    const code = (searchParams.get("code") || "").toUpperCase().trim();
    if (!code) {
      return ApiErrors.badRequest("Meeting code required");
    }

    // Scheduled meeting (DB)
    const meeting = sqlite
      .prepare(
        "SELECT title, password, allow_guests FROM scheduled_meetings WHERE meeting_code = ? AND is_active = 1"
      )
      .get(code) as
      | { title?: string; password?: string | null; allow_guests?: number }
      | undefined;

    if (meeting) {
      return apiSuccess({
        exists: true,
        hasPassword: !!meeting.password,
        allowGuests: !!meeting.allow_guests,
        title: meeting.title ?? null,
      });
    }

    // On-demand meeting (in-memory, created via BroadcastStudio)
    const active = findActiveMeetingByCode(code);
    if (active) {
      return apiSuccess({
        exists: true,
        hasPassword: !!active.password,
        allowGuests: true,
        title: active.title ?? null,
      });
    }

    return apiSuccess({
      exists: false,
      hasPassword: false,
      allowGuests: false,
      title: null,
    });
  } catch (error) {
    console.error("Meeting lookup error:", error);
    return ApiErrors.internal();
  }
}
