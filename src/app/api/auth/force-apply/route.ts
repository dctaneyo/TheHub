import { NextRequest, NextResponse } from "next/server";
import { verifyToken } from "@/lib/auth";

function setTokenCookie(response: NextResponse, token: string) {
  response.cookies.set("hub-token", token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
}

// Sanitize redirect path — only allow relative paths starting with /
function safeRedirect(raw: string | null): string {
  if (!raw) return "/login";
  // Strip anything that isn't a simple relative path
  if (!raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\")) return "/login";
  // Remove any characters that could break out of a JS string literal
  return raw.replace(/["'<>\\]/g, "");
}

// GET - Apply token from query params, set cookie, client-side redirect via HTML
// (avoids NextResponse.redirect which uses req.url → internal 0.0.0.0 address)
export async function GET(req: NextRequest) {
  const token = req.nextUrl.searchParams.get("token");
  const redirectTo = safeRedirect(req.nextUrl.searchParams.get("redirect"));

  if (!token || !verifyToken(token)) {
    return new NextResponse(
      `<html><body><script>window.location.href="/login";</script></body></html>`,
      { status: 200, headers: { "Content-Type": "text/html" } }
    );
  }

  const response = new NextResponse(
    `<html><body><script>window.location.href="${redirectTo}";</script></body></html>`,
    { status: 200, headers: { "Content-Type": "text/html" } }
  );
  setTokenCookie(response, token);
  return response;
}

// POST - Apply token from JSON body, set cookie, client handles redirect
export async function POST(req: NextRequest) {
  try {
    const { token } = await req.json();

    if (!token || !verifyToken(token)) {
      return NextResponse.json({ error: "Invalid token" }, { status: 400 });
    }

    const response = NextResponse.json({ success: true });
    setTokenCookie(response, token);
    return response;
  } catch {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }
}
