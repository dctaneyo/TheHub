import { randomBytes } from "crypto";
import { sqlite } from "@/lib/db";

// Secure one-click meeting invites. An invite is an opaque token that grants
// join access to a meeting WITHOUT exposing the meeting password in the URL.
// Invites are reusable within their validity window (so a disconnected user can
// rejoin) and can optionally expire.

export interface MeetingInviteRow {
  token: string;
  meeting_code: string;
  tenant_id: string | null;
  created_by: string | null;
  expires_at: string | null;
  revoked: number;
  created_at: string;
}

export function createMeetingInvite(opts: {
  meetingCode: string;
  tenantId?: string | null;
  createdBy?: string | null;
  expiresInHours?: number | null;
}): { token: string; expiresAt: string | null } {
  const token = randomBytes(18).toString("base64url"); // 24-char URL-safe token
  const now = new Date();
  const expiresAt =
    opts.expiresInHours && opts.expiresInHours > 0
      ? new Date(now.getTime() + opts.expiresInHours * 3600_000).toISOString()
      : null;

  sqlite
    .prepare(
      `INSERT INTO meeting_invites (token, meeting_code, tenant_id, created_by, expires_at, revoked, created_at)
       VALUES (?, ?, ?, ?, ?, 0, ?)`
    )
    .run(
      token,
      opts.meetingCode.toUpperCase().trim(),
      opts.tenantId ?? null,
      opts.createdBy ?? null,
      expiresAt,
      now.toISOString()
    );

  return { token, expiresAt };
}

export function getMeetingInvite(token: string): MeetingInviteRow | null {
  if (!token) return null;
  const row = sqlite
    .prepare("SELECT * FROM meeting_invites WHERE token = ?")
    .get(token) as MeetingInviteRow | undefined;
  return row ?? null;
}

export function inviteStatus(token: string): {
  valid: boolean;
  expired: boolean;
  meetingCode: string | null;
} {
  const row = getMeetingInvite(token);
  if (!row) return { valid: false, expired: false, meetingCode: null };
  if (row.revoked) return { valid: false, expired: false, meetingCode: row.meeting_code };
  if (row.expires_at && new Date(row.expires_at).getTime() < Date.now()) {
    return { valid: false, expired: true, meetingCode: row.meeting_code };
  }
  return { valid: true, expired: false, meetingCode: row.meeting_code };
}

/** True if `token` is a valid invite that grants access to `meetingCode`. */
export function inviteGrantsAccess(
  token: string | undefined | null,
  meetingCode: string
): boolean {
  if (!token) return false;
  const st = inviteStatus(token);
  return (
    st.valid &&
    !!st.meetingCode &&
    st.meetingCode.toUpperCase() === meetingCode.toUpperCase().trim()
  );
}
