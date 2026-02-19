import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

// POST - Apply a force-redirect token: sets the auth cookie, client handles redirect
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token) {
      return NextResponse.json({ error: "No token" }, { status: 400 });
    }

    const payload = verifyToken(token);
    if (!payload) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("hub-token", token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 60 * 60 * 24, // 24 hours
      path: "/",
    });

    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
