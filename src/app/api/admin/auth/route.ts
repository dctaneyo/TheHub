import { NextResponse } from "next/server";
import { getAdminSession } from "@/lib/admin-auth";
import { clearAdminActivity } from "@/lib/admin-session-activity";

// DELETE — logout (clear cookie + idle-tracking entry)
export async function DELETE() {
  const session = await getAdminSession();
  if (session) clearAdminActivity(session.adminId);

  const response = NextResponse.json({ ok: true, success: true });
  response.cookies.set("hub-admin-token", "", { maxAge: 0, path: "/" });
  return response;
}
