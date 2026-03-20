import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized, forbidden } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { setPendingForceAction } from "@/lib/socket-server";
import { validate, createRoleSchema, updateRoleSchema, deleteRoleSchema } from "@/lib/validations";

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

    const body = await req.json();
    const parsed = validate(createRoleSchema, body);
    if (!parsed.success) return ApiErrors.badRequest(parsed.error);
    const { name, description, permissions } = parsed.data;

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

    const body = await req.json();
    const parsed = validate(updateRoleSchema, body);
    if (!parsed.success) return ApiErrors.badRequest(parsed.error);
    const { id, name, description, permissions } = parsed.data;

    // Prevent editing default system roles
    const existing = db.select().from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).get();
    if (!existing) return ApiErrors.notFound("Role");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name.trim();
    if (description !== undefined) updates.description = description?.trim() || null;
    if (permissions !== undefined) updates.permissions = JSON.stringify(permissions);

    db.update(schema.roles).set(updates)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).run();

    // When role permissions change, force refresh for all ARLs using this role
    if (permissions !== undefined) {
      const affectedArls = db.select({ userId: schema.arls.id })
        .from(schema.arls)
        .where(and(eq(schema.arls.roleId, id), eq(schema.arls.tenantId, session.tenantId))).all();
      for (const arl of affectedArls) {
        const arlSession = db.select({ token: schema.sessions.token })
          .from(schema.sessions)
          .where(and(eq(schema.sessions.userId, arl.userId), eq(schema.sessions.isOnline, true)))
          .get();
        if (arlSession?.token) {
          setPendingForceAction(arlSession.token, { action: "redirect", redirectTo: "/arl" });
        }
      }
    }

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

    const body = await req.json();
    const parsed = validate(deleteRoleSchema, body);
    if (!parsed.success) return ApiErrors.badRequest(parsed.error);
    const { id } = parsed.data;

    // Prevent deleting system default roles
    const existing = db.select().from(schema.roles)
      .where(and(eq(schema.roles.id, id), eq(schema.roles.tenantId, session.tenantId))).get();
    if (!existing) return ApiErrors.notFound("Role");
    if (existing.isDefault) return ApiErrors.badRequest("Cannot delete system default roles");

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
