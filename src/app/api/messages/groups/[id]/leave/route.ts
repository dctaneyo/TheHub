import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { getSession } from "@/lib/auth";

// POST /api/messages/groups/:id/leave - Leave group
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const { id: conversationId } = await params;

    // Find user's membership
    const member = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.memberId, session.id),
          eq(schema.conversationMembers.memberType, session.userType),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .get();

    if (!member) {
      return NextResponse.json(
        { error: "Not a member of this group" },
        { status: 404 }
      );
    }

    // Check if user is the last admin
    const activeMembers = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .all();

    const admins = activeMembers.filter((m) => m.role === "admin");

    if (member.role === "admin" && admins.length === 1) {
      // Last admin - need to promote someone else or can't leave
      const otherMembers = activeMembers.filter(
        (m) => m.id !== member.id && m.role === "member"
      );

      if (otherMembers.length > 0) {
        // Promote the first other member to admin
        db.update(schema.conversationMembers)
          .set({ role: "admin" })
          .where(eq(schema.conversationMembers.id, otherMembers[0].id))
          .run();
      } else {
        // No one else to promote - this is the last member, they can leave
      }
    }

    // Mark as left
    db.update(schema.conversationMembers)
      .set({ leftAt: new Date().toISOString() })
      .where(eq(schema.conversationMembers.id, member.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to leave group:", error);
    return NextResponse.json(
      { error: "Failed to leave group" },
      { status: 500 }
    );
  }
}
