import { NextRequest, NextResponse } from "next/server";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

// POST — verify admin secret and return a session token
export async function POST(req: NextRequest) {
  try {
    if (!ADMIN_SECRET) {
      return NextResponse.json(
        { error: "Admin portal is not configured. Set ADMIN_SECRET env var." },
        { status: 503 }
      );
    }

    const { secret } = await req.json();

    if (!secret || secret !== ADMIN_SECRET) {
      return NextResponse.json({ error: "Invalid secret" }, { status: 401 });
    }

    // Set an httpOnly cookie so subsequent API calls are authenticated
    const response = NextResponse.json({ success: true });
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE — logout (clear cookie)
export async function DELETE() {
  const response = NextResponse.json({ success: true });
  response.cookies.set("hub-admin-token", "", { maxAge: 0, path: "/" });
  return response;
}
