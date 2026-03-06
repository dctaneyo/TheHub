import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, requirePermission } from "@/lib/api-helpers";
import { PERMISSIONS } from "@/lib/permissions";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { validate, createLocationGroupSchema, updateLocationGroupSchema } from "@/lib/validations";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();

    const groups = await db.select().from(schema.locationGroups)
      .where(eq(schema.locationGroups.tenantId, session.tenantId)).all();

    // Fetch members for each group
    const groupsWithMembers = await Promise.all(groups.map(async (group) => {
      const members = await db.select({ locationId: schema.locationGroupMembers.locationId })
        .from(schema.locationGroupMembers)
        .where(eq(schema.locationGroupMembers.groupId, group.id)).all();
      return {
        ...group,
        locationIds: members.map((m) => m.locationId),
      };
    }));

    return apiSuccess({ groups: groupsWithMembers });
  } catch (error) {
    console.error("Get location groups error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_CREATE);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(createLocationGroupSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, description, color, parentId, locationIds } = parsed.data;

    const now = new Date().toISOString();
    const group = {
      id: uuid(),
      tenantId: session.tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      color: color || null,
      parentId: parentId || null,
      createdAt: now,
      updatedAt: now,
    };

    await db.insert(schema.locationGroups).values(group).run();

    // Add members if provided
    if (locationIds && locationIds.length > 0) {
      for (const locationId of locationIds) {
        await db.insert(schema.locationGroupMembers).values({
          id: uuid(),
          groupId: group.id,
          locationId,
          createdAt: now,
        }).run();
      }
    }

    return apiSuccess({ group: { ...group, locationIds: locationIds || [] } });
  } catch (error) {
    console.error("Create location group error:", error);
    return ApiErrors.internal();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_EDIT);
    if (denied) return denied;

    const body = await req.json();
    const parsed = validate(updateLocationGroupSchema, body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { id, name, description, color, parentId, locationIds } = parsed.data;

    const existing = await db.select().from(schema.locationGroups)
      .where(and(eq(schema.locationGroups.id, id), eq(schema.locationGroups.tenantId, session.tenantId))).get();
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (color !== undefined) updates.color = color;
    if (parentId !== undefined) updates.parentId = parentId;

    await db.update(schema.locationGroups).set(updates)
      .where(and(eq(schema.locationGroups.id, id), eq(schema.locationGroups.tenantId, session.tenantId))).run();

    // Update members if provided
    if (locationIds !== undefined) {
      // Clear existing members
      await db.delete(schema.locationGroupMembers)
        .where(eq(schema.locationGroupMembers.groupId, id)).run();
      // Add new members
      const now = new Date().toISOString();
      for (const locationId of locationIds) {
        await db.insert(schema.locationGroupMembers).values({
          id: uuid(),
          groupId: id,
          locationId,
          createdAt: now,
        }).run();
      }
    }

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update location group error:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "ARL access required" }, { status: 403 });
    }
    const denied = await requirePermission(session, PERMISSIONS.LOCATIONS_DELETE);
    if (denied) return denied;

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const existing = await db.select().from(schema.locationGroups)
      .where(and(eq(schema.locationGroups.id, id), eq(schema.locationGroups.tenantId, session.tenantId))).get();
    if (!existing) return NextResponse.json({ error: "Group not found" }, { status: 404 });

    // Delete members first
    await db.delete(schema.locationGroupMembers)
      .where(eq(schema.locationGroupMembers.groupId, id)).run();

    // Delete the group
    await db.delete(schema.locationGroups)
      .where(and(eq(schema.locationGroups.id, id), eq(schema.locationGroups.tenantId, session.tenantId))).run();

    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete location group error:", error);
    return ApiErrors.internal();
  }
}
