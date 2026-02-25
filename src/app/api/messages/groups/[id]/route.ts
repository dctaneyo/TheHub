import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import * as schema from "@/lib/db/schema";
import { eq, and, isNull } from "drizzle-orm";
import { v4 as uuidv4 } from "uuid";
import { getSession } from "@/lib/auth";

// GET /api/messages/groups/:id - Get group details
export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const conversationId = params.id;

    // Get conversation details
    const conversation = db
      .select()
      .from(schema.conversations)
      .where(eq(schema.conversations.id, conversationId))
      .get();

    if (!conversation || conversation.type !== "group") {
      return NextResponse.json({ error: "Group not found" }, { status: 404 });
    }

    // Get active members (leftAt is null)
    const members = db
      .select()
      .from(schema.conversationMembers)
      .where(
        and(
          eq(schema.conversationMembers.conversationId, conversationId),
          isNull(schema.conversationMembers.leftAt)
        )
      )
      .all();

    // Get member details
    const memberDetails = members.map((member) => {
      let name = "Unknown";
      if (member.memberType === "location") {
        const location = db
          .select()
          .from(schema.locations)
          .where(eq(schema.locations.id, member.memberId))
          .get();
        name = location?.name || "Unknown Location";
      } else if (member.memberType === "arl") {
        const arl = db
          .select()
          .from(schema.arls)
          .where(eq(schema.arls.id, member.memberId))
          .get();
        name = arl?.name || "Unknown ARL";
      }

      return {
        id: member.id,
        memberId: member.memberId,
        memberType: member.memberType,
        name,
        role: member.role,
        joinedAt: member.joinedAt,
      };
    });

    return NextResponse.json({
      id: conversation.id,
      name: conversation.name,
      description: conversation.description,
      avatarColor: conversation.avatarColor,
      createdBy: conversation.createdBy,
      createdAt: conversation.createdAt,
      members: memberDetails,
      memberCount: memberDetails.length,
    });
  } catch (error) {
    console.error("Failed to get group details:", error);
    return NextResponse.json(
      { error: "Failed to get group details" },
      { status: 500 }
    );
  }
}

// PATCH /api/messages/groups/:id - Update group info (name, description, avatarColor)
export async function PATCH(
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
    const { name, description, avatarColor } = body;

    // Check if user is admin of this group
    const member = db
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

    if (!member || member.role !== "admin") {
      return NextResponse.json(
        { error: "Only admins can update group info" },
        { status: 403 }
      );
    }

    // Update conversation
    const updates: any = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (avatarColor !== undefined) updates.avatarColor = avatarColor;

    if (Object.keys(updates).length > 0) {
      db.update(schema.conversations)
        .set(updates)
        .where(eq(schema.conversations.id, conversationId))
        .run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Failed to update group:", error);
    return NextResponse.json(
      { error: "Failed to update group" },
      { status: 500 }
    );
  }
}
