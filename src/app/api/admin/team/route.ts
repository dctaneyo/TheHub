import { NextRequest } from "next/server";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { hashSync } from "bcryptjs";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { requireAdminSession } from "@/lib/api-helpers";
import { verifyAdminPinReconfirmation } from "@/lib/admin-auth";
import { logAudit } from "@/lib/audit-logger";

// GET — list platform admins. Flat permissions: any admin can manage any
// other — a tiered hierarchy would be over-engineering for a handful of
// operators.
export async function GET() {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const admins = db.select({
      id: schema.platformAdmins.id,
      email: schema.platformAdmins.email,
      name: schema.platformAdmins.name,
      isActive: schema.platformAdmins.isActive,
      createdAt: schema.platformAdmins.createdAt,
    }).from(schema.platformAdmins).all();

    return apiSuccess({ admins });
  } catch (error) {
    console.error("List admins error:", error);
    return ApiErrors.internal();
  }
}

// POST — invite a new platform admin (sets their initial password + PIN directly, no email flow yet).
export async function POST(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { email, name, password, pin } = await req.json();
    if (!email || !name || !password || !pin) {
      return ApiErrors.badRequest("email, name, password, and pin are required");
    }
    if (!/^\d{6}$/.test(pin)) return ApiErrors.badRequest("PIN must be exactly 6 digits");

    const existing = db.select({ id: schema.platformAdmins.id }).from(schema.platformAdmins).where(eq(schema.platformAdmins.email, email)).get();
    if (existing) return ApiErrors.badRequest("An admin with this email already exists");

    const now = new Date().toISOString();
    const id = uuid();
    db.insert(schema.platformAdmins).values({
      id, email, name,
      passwordHash: hashSync(password, 10),
      pinHash: hashSync(pin, 10),
      isActive: true,
      createdAt: now, updatedAt: now,
    }).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "admin_created", entityType: "platform_admin", payload: { targetAdminId: id, email }, status: "success" });

    return apiSuccess({ id });
  } catch (error) {
    console.error("Create admin error:", error);
    return ApiErrors.internal();
  }
}

// PUT — update an admin (name, active status; password/PIN changes go through a separate flow, not this route)
export async function PUT(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id, name, isActive } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.platformAdmins).set(updates).where(eq(schema.platformAdmins.id, id)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "admin_updated", entityType: "platform_admin", payload: { targetAdminId: id, ...updates }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Update admin error:", error);
    return ApiErrors.internal();
  }
}

// PATCH — change an admin's password and/or PIN. PIN re-confirmation required
// so a hijacked session can't silently change credentials. Any admin can
// change any other admin's credentials (flat permissions, same as the rest).
export async function PATCH(req: NextRequest) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id, newPassword, newPin, confirmPin } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");
    if (!confirmPin) return ApiErrors.badRequest("Current PIN required to authorize credential changes");
    if (!newPassword && !newPin) return ApiErrors.badRequest("Provide newPassword and/or newPin");
    if (newPin && !/^\d{6}$/.test(newPin)) return ApiErrors.badRequest("PIN must be exactly 6 digits");

    const pinCheck = verifyAdminPinReconfirmation(auth.session.adminId, confirmPin);
    if (!pinCheck.ok) return ApiErrors.unauthorized();

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (newPassword) updates.passwordHash = hashSync(newPassword, 10);
    if (newPin) updates.pinHash = hashSync(newPin, 10);

    db.update(schema.platformAdmins).set(updates).where(eq(schema.platformAdmins.id, id)).run();

    logAudit({
      userId: auth.session.adminId, userType: "platform_admin", operation: "admin_credentials_changed",
      entityType: "platform_admin",
      payload: { targetAdminId: id, changedPassword: !!newPassword, changedPin: !!newPin }, status: "success",
    });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Change credentials error:", error);
    return ApiErrors.internal();
  }
}

// DELETE — deactivate an admin (soft delete — same convention as tenants)
export async function DELETE(req: Request) {
  const auth = await requireAdminSession();
  if ("response" in auth) return auth.response;

  try {
    const { id } = await req.json();
    if (!id) return ApiErrors.badRequest("ID required");
    if (id === auth.session.adminId) return ApiErrors.forbidden("Cannot deactivate your own account");

    db.update(schema.platformAdmins).set({ isActive: false, updatedAt: new Date().toISOString() }).where(eq(schema.platformAdmins.id, id)).run();

    logAudit({ userId: auth.session.adminId, userType: "platform_admin", operation: "admin_deactivated", entityType: "platform_admin", payload: { targetAdminId: id }, status: "success" });

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Deactivate admin error:", error);
    return ApiErrors.internal();
  }
}
