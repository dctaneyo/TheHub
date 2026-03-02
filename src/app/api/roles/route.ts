import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, forbidden } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function GET() {
  try {
    const session = await getAuthSession();
    if (!session) return unauthorized();
    if (session.userType !== "arl") return forbidden("ARL access required");

    const roles = db.select().from(schema.roles)
      .where(eq(schema.roles.tenantId, session.tenantId)).all();

    return apiSuccess({
      roles: roles.map((r) => ({
        ...r,
        permissions: JSON.parse(r.permissions || "[]"),
      })),
    });
  } catch (error) {
    console.error("Get roles error:", error);
    return ApiErrors.internal();
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return forbidden("ARL access required");

    // Only admins can create roles
    const callerArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId))).get();
    if (callerArl?.role !== "admin") return forbidden("Admin access required");

    const { name, description, permissions } = await req.json();
    if (!name?.trim()) return NextResponse.json({ error: "Name is required" }, { status: 400 });
    if (!Array.isArray(permissions)) return NextResponse.json({ error: "Permissions must be an array" }, { status: 400 });

    const now = new Date().toISOString();
    const role = {
      id: uuid(),
      tenantId: session.tenantId,
      name: name.trim(),
      description: description?.trim() || null,
      permissions: JSON.stringify(permissions),
      isDefault: false,
      createdAt: now,
      updatedAt: now,
    };

    db.insert(schema.roles).values(role).run();
    return apiSuccess({ role: { ...role, permissions } });
  } catch (error) {
    console.error("Create role error:", error);
    return ApiErrors.internal();
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return forbidden("ARL access required");

    const callerArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId))).get();
    if (callerArl?.role !== "admin") return forbidden("Admin access required");

    const { id, name, description, permissions } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Prevent editing default system roles
    const existing = db.select().from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).get();
    if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

    db.update(schema.roles).set(updates)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).run();

    return apiSuccess({ updated: true });
  } catch (error) {
    console.error("Update role error:", error);
    return ApiErrors.internal();
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") return forbidden("ARL access required");

    const callerArl = db.select({ role: schema.arls.role }).from(schema.arls)
      .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId))).get();
    if (callerArl?.role !== "admin") return forbidden("Admin access required");

    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    // Prevent deleting system default roles
    const existing = db.select().from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).get();
    if (!existing) return NextResponse.json({ error: "Role not found" }, { status: 404 });
    if (existing.isDefault) return NextResponse.json({ error: "Cannot delete system default roles" }, { status: 400 });

    // Clear roleId from any ARLs using this role
    const affectedArls = db.select({ id: schema.arls.id }).from(schema.arls)
      .where(and(eq(schema.arls.roleId, id), eq(schema.arls.tenantId, session.tenantId))).all();
    for (const arl of affectedArls) {
      db.update(schema.arls).set({ roleId: null }).where(eq(schema.arls.id, arl.id)).run();
    }

    db.delete(schema.roles).where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).run();
    return apiSuccess({ deleted: true });
  } catch (error) {
    console.error("Delete role error:", error);
    return ApiErrors.internal();
  }
}
