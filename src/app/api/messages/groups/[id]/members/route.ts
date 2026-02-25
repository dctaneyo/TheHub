import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

// PUT /api/messages/groups/:id/members - Add members to group
export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversationId = params.id;
    const body = await req.json();
    const { memberIds, memberTypes } = body;

    if (!memberIds || !memberTypes || memberIds.length !== memberTypes.length) {
      return NextResponse.json(
        { error: "Invalid member data" },
        { status: 400 }
      );
    }

    // Check if user is admin of this group
    const userMember = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.memberId, session.userId),
          eq(schema.conversationMembers.memberType, session.userType),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .get();

    if (!userMember || userMember.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can add members" },
        { status: 403 }
      );
    }

    // Add new members
    const addedMembers = [];
    for (let i = 0; i < memberIds.length; i++) {
      const memberId = memberIds[i];
      const memberType = memberTypes[i];

      // Check if member already exists
      const existingMember = db
        .select()
        .from(schema.conversationMembers)
        .where(
          and(
            eq(schema.conversationMembers.conversationId, conversationId),
            eq(schema.conversationMembers.memberId, memberId),
            eq(schema.conversationMembers.memberType, memberType)
          )
        )
        .get();

      if (existingMember) {
        // If they left before, re-add them
        if (existingMember.leftAt) {
          db.update(schema.conversationMembers)
            .set({
              leftAt: null,
              joinedAt: new Date().toISOString(),
            })
            .where(eq(schema.conversationMembers.id, existingMember.id))
            .run();
          addedMembers.push(memberId);
        }
      } else {
        // Add new member
        db.insert(schema.conversationMembers)
          .values({
            id: uuidv4(),
            conversationId,
            memberId,
            memberType,
            role: "member",
            joinedAt: new Date().toISOString(),
          })
          .run();
        addedMembers.push(memberId);
      }
    }

    return NextResponse.json({
      success: true,
      addedCount: addedMembers.length,
    });
  } catch (error) {
    console.error("Failed to add members:", error);
    return NextResponse.json(
      { error: "Failed to add members" },
      { status: 500 }
    );
  }
}

// DELETE /api/messages/groups/:id/members/:userId - Remove member from group
export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversationId = params.id;
    const url = new URL(req.url);
    const memberIdToRemove = url.searchParams.get("memberId");
    const memberTypeToRemove = url.searchParams.get("memberType");

    if (!memberIdToRemove || !memberTypeToRemove) {
      return NextResponse.json(
        { error: "Missing memberId or memberType" },
        { status: 400 }
      );
    }

    // Check if user is admin of this group
    const userMember = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.memberId, session.userId),
          eq(schema.conversationMembers.memberType, session.userType),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .get();

    if (!userMember || userMember.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can remove members" },
        { status: 403 }
      );
    }

    // Can't remove yourself this way (use leave endpoint)
    if (
      memberIdToRemove === session.userId &&
      memberTypeToRemove === session.userType
    ) {
      return NextResponse.json(
        { error: "Use leave endpoint to leave group" },
        { status: 400 }
      );
    }

    // Find and remove member
    const memberToRemove = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          eq(schema.conversationMembers.memberId, memberIdToRemove),
          eq(schema.conversationMembers.memberType, memberTypeToRemove),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .get();

    if (!memberToRemove) {
      return NextResponse.json(
        { error: "Member not found in group" },
        { status: 404 }
      );
    }

    // Mark as left
    db.update(schema.conversationMembers)
      .set({ leftAt: new Date().toISOString() })
      .where(eq(schema.conversationMembers.id, memberToRemove.id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to remove member:", error);
    return NextResponse.json(
      { error: "Failed to remove member" },
      { status: 500 }
    );
  }
}
