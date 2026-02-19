import { NextRequest, NextResponse } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// GET - Login page polls this to check if their pending session was activated
// No auth required (the login page doesn't have a token yet)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const pendingId = searchParams.get("id");

    if (!pendingId) {
      return NextResponse.json({ error: "id parameter required" }, { status: 400 });
    }

    const pending = db
      .select()
      .from(schema.pendingSessions)
      .where(eq(schema.pendingSessions.id, pendingId))
      .get();

    if (!pending) {
      return NextResponse.json({ status: "expired" });
    }

    // Check if expired
    if (new Date(pending.expiresAt) < new Date()) {
      return NextResponse.json({ status: "expired" });
    }

    if (pending.status === "activated" && pending.token && pending.redirectTo) {
      // Set the auth cookie and tell the client to redirect
      const response = NextResponse.json({
        status: "activated",
        redirectTo: pending.redirectTo,
      });

      response.cookies.set("hub-token", pending.token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24, // 24 hours
        path: "/",
      });

      return response;
    }

    return NextResponse.json({ status: "pending" });
  } catch (error) {
    console.error("Pending session status error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
