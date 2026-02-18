import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";

export async function POST() {
  try {
    const session = await getSession();

    if (session) {
      // Mark sessions as offline
      const allSessions = db
        .select()
        .from(schema.sessions)
        .where(
          and(
            eq(schema.sessions.userId, session.id),
            eq(schema.sessions.userType, session.userType)
          )
        )
        .all();

      for (const s of allSessions) {
        db.update(schema.sessions)
          .set({ isOnline: false, lastSeen: new Date().toISOString() })
          .where(eq(schema.sessions.id, s.id))
          .run();
      }
    }

    const response = NextResponse.json({ success: true });
    response.cookies.set("hub-token", "", {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      maxAge: 0,
      path: "/",
    });

    return response;
  } catch (error) {
    console.error("Logout error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
