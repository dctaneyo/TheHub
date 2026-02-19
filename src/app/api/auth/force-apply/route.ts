import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// GET - Apply a force-redirect token: sets the auth cookie and redirects
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectTo = req.nextUrl.searchParams.get("redirect") || "/login";

  if (!token) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  // Verify token is valid before setting it
  const payload = verifyToken(token);
  if (!payload) {
    return NextResponse.redirect(new URL("/login", req.url));
  }

  const response = NextResponse.redirect(new URL(redirectTo, req.url));
  response.cookies.set("hub-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    maxAge: 60 * 60 * 24, // 24 hours
    path: "/",
  });

  return response;
}
