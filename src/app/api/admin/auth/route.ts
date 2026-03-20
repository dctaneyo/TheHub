import { NextRequest, NextResponse } from "next/server";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// POST — verify admin secret and return a session token
export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_SECRET) {
      return ApiErrors.internal("Admin portal is not configured. Set ADMIN_SECRET env var.");
    }

    const { secret } = await req.json();

    if (!secret || secret !== ADMIN_SECRET) {
      return ApiErrors.unauthorized();
    }

    // Set an httpOnly cookie so subsequent API calls are authenticated
    const response = NextResponse.json({ ok: true, success: true });
    response.cookies.set("hub-admin-token", ADMIN_SECRET, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "strict",
      path: "/",
      maxAge: 60 * 60 * 8, // 8 hours
    });

    return response;
  } catch (error) {
    console.error("Admin auth error:", error);
    return ApiErrors.internal();
  }
}

// DELETE — logout (clear cookie)
export async function DELETE() {
  const response = NextResponse.json({ ok: true, success: true });
  response.cookies.set("hub-admin-token", "", { maxAge: 0, path: "/" });
  return response;
}
