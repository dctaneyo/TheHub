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

    // Get conversation details
    const conversation = db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation) {
      return NextResponse.json(
        { error: "Group not found" },
        { status: 404 }
      );
    }

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

    // Check if user is the group creator
    const isCreator = conversation.createdBy === session.id && conversation.createdByType === session.userType;

    if (isCreator) {
      // Creator leaving = delete the entire group
      // Delete all members
      db.delete(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, conversationId))
        .run();
      
      // Delete all messages
      db.delete(schema.messages)
        .where(eq(schema.messages.conversationId, conversationId))
        .run();
      
      // Delete the conversation
      db.delete(schema.conversations)
        .where(eq(schema.conversations.id, conversationId))
        .run();

      return NextResponse.json({ success: true, deleted: true });
    }

    // Non-creator leaving = just mark as left
    db.update(schema.conversationMembers)
      .set({ leftAt: new Date().toISOString() })
      .where(eq(schema.conversationMembers.id, member.id))
      .run();

    return NextResponse.json({ success: true, deleted: false });
  } catch (error) {
    console.error("Failed to leave group:", error);
    return NextResponse.json(
      { error: "Failed to leave group" },
      { status: 500 }
    );
  }
}
