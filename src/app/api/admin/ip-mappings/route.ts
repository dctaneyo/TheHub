import { NextRequest } from "next/server";
import { getAuthSession } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

/**
 * Verify the caller is an ARL or admin.
 * Returns the session if authorized, or a Response if denied.
 */
async function requireArlOrAdmin() {
  const session = await getAuthSession();
  if (!session) return { error: ApiErrors.unauthorized() };
  if (session.userType !== "arl") return { error: ApiErrors.forbidden("ARL or admin access required") };

  // Check role from DB — admins always pass, ARLs with 'arl' role also pass
  const arl = db
    .select({ role: schema.arls.role })
    .from(schema.arls)
    .where(and(eq(schema.arls.id, session.id), eq(schema.arls.tenantId, session.tenantId)))
    .get();

  if (!arl) return { error: ApiErrors.forbidden("ARL not found") };

  return { session };
}

// Simple IPv4/IPv6 format check
function isValidIpAddress(ip: string): boolean {
  // IPv4
  const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
  if (ipv4.test(ip)) {
    return ip.split(".").every((octet) => {
      const n = parseInt(octet, 10);
      return n >= 0 && n <= 255;
    });
  }
  // IPv6 (simplified — accepts standard and compressed forms)
  const ipv6 = /^([0-9a-fA-F]{0,4}:){2,7}[0-9a-fA-F]{0,4}$/;
  if (ipv6.test(ip)) return true;
  // IPv6 loopback
  if (ip === "::1") return true;
  return false;
}

// GET /api/admin/ip-mappings — list all mappings for the current tenant
export async function GET() {
  const auth = await requireArlOrAdmin();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const mappings = db
      .select()
      .from(schema.orgIpMappings)
      .where(eq(schema.orgIpMappings.tenantId, session.tenantId))
      .all();

    return apiSuccess({ mappings });
  } catch (error) {
    console.error("List IP mappings error:", error);
    return ApiErrors.internal();
  }
}

// POST /api/admin/ip-mappings — create a new mapping
export async function POST(req: NextRequest) {
  const auth = await requireArlOrAdmin();
  if ("error" in auth) return auth.error;
  const { session } = auth;

  try {
    const body = await req.json();
    const { ipAddress, tenantId } = body;

    if (!ipAddress || typeof ipAddress !== "string") {
      return ApiErrors.badRequest("ipAddress is required");
    }

    if (!isValidIpAddress(ipAddress.trim())) {
      return ApiErrors.badRequest("Invalid IP address format");
    }

    // Use the provided tenantId or fall back to the session's tenant
    const effectiveTenantId = tenantId || session.tenantId;

    // Verify the tenant exists and is active
    const tenant = db
      .select({ id: schema.tenants.id, isActive: schema.tenants.isActive })
      .from(schema.tenants)
      .where(eq(schema.tenants.id, effectiveTenantId))
      .get();

    if (!tenant || !tenant.isActive) {
      return ApiErrors.badRequest("Tenant not found or inactive");
    }

    // Check for duplicate IP
    const existing = db
      .select({ id: schema.orgIpMappings.id })
      .from(schema.orgIpMappings)
      .where(eq(schema.orgIpMappings.ipAddress, ipAddress.trim()))
      .get();

    if (existing) {
      return ApiErrors.badRequest("This IP address is already mapped");
    }

    const id = uuid();
    const now = new Date().toISOString();

    db.insert(schema.orgIpMappings)
      .values({
        id,
        tenantId: effectiveTenantId,
        ipAddress: ipAddress.trim(),
        createdBy: session.id,
        createdAt: now,
      })
      .run();

    return apiSuccess({ id }, 201);
  } catch (error) {
    console.error("Create IP mapping error:", error);
    return ApiErrors.internal();
  }
}
