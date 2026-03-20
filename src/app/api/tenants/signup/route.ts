import { NextRequest, NextResponse } from "next/server";
import { db, schema, sqlite } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";
import { apiSuccess, ApiErrors } from "@/lib/api-response";
import { checkRateLimit, getClientIP } from "@/lib/rate-limiter";

const ALL_FEATURES = ["messaging", "tasks", "forms", "gamification", "meetings", "analytics", "broadcasts"];

const PLAN_LIMITS: Record<string, { maxLocations: number; maxUsers: number }> = {
  starter: { maxLocations: 10, maxUsers: 5 },
  pro: { maxLocations: 50, maxUsers: 20 },
  enterprise: { maxLocations: 500, maxUsers: 100 },
};

export async function POST(req: NextRequest) {
  try {
    const ip = getClientIP(req.headers);
    const rl = checkRateLimit(`signup:${ip}`, { maxAttempts: 3, windowMs: 60_000, lockoutMs: 10 * 60_000 });
    if (!rl.allowed) return ApiErrors.tooManyRequests(Math.ceil((rl.retryAfterMs || 0) / 1000));

    const body = await req.json();
    const {
      // Tenant info
      slug,
      name,
      appTitle,
      primaryColor,
      plan,
      // First admin user
      adminName,
      adminUserId,
      adminPin,
    } = body;

    // ── Validation ──
    if (!slug || !name || !adminName || !adminUserId || !adminPin) {
      return ApiErrors.badRequest("All fields are required: slug, name, adminName, adminUserId, adminPin");
    }

    // Slug format: lowercase, alphanumeric + hyphens, 3-30 chars
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      return ApiErrors.badRequest("Slug must be 3-30 characters (lowercase letters, numbers, hyphens)");
    }

    // Reserved slugs
    const reserved = ["admin", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];
    if (reserved.includes(cleanSlug)) {
      return ApiErrors.badRequest("This subdomain is reserved");
    }

    // Admin userId: 4 digits
    if (!/^\d{4}$/.test(adminUserId)) {
      return ApiErrors.badRequest("Admin user ID must be exactly 4 digits");
    }

    // Admin PIN: 4 digits
    if (!/^\d{4}$/.test(adminPin)) {
      return ApiErrors.badRequest("Admin PIN must be exactly 4 digits");
    }

    // ── Check uniqueness ──
    const existingTenant = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
    if (existingTenant) {
      return ApiErrors.badRequest("This subdomain is already taken");
    }

    // Check if adminUserId is globally unique
    const existingArl = db.select().from(schema.arls).where(eq(schema.arls.userId, adminUserId)).get();
    const existingLoc = db.select().from(schema.locations).where(eq(schema.locations.userId, adminUserId)).get();
    if (existingArl || existingLoc) {
      return ApiErrors.badRequest("This user ID is already in use");
    }

    // ── Create tenant + admin in a transaction ──
    const now = new Date().toISOString();
    const tenantId = cleanSlug; // Use slug as ID (matches middleware lookup pattern)
    const adminId = uuid();
    const limits = PLAN_LIMITS[plan || "starter"] || PLAN_LIMITS.starter;
    const pinHash = await bcrypt.hash(adminPin, 10);

    const transaction = sqlite.transaction(() => {
      // Create tenant
      db.insert(schema.tenants).values({
        id: tenantId,
        slug: cleanSlug,
        name,
        appTitle: appTitle || `${name} Hub`,
        primaryColor: primaryColor || "#dc2626",
        plan: plan || "starter",
        features: JSON.stringify(ALL_FEATURES),
        maxLocations: limits.maxLocations,
        maxUsers: limits.maxUsers,
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).run();

      // Create first admin user
      db.insert(schema.arls).values({
        id: adminId,
        tenantId,
        name: adminName,
        userId: adminUserId,
        pinHash,
        role: "admin",
        permissions: null, // null = all permissions
        isActive: true,
        createdAt: now,
        updatedAt: now,
      }).run();
    });

    transaction();

    return apiSuccess({
      success: true,
      tenant: {
        id: tenantId,
        slug: cleanSlug,
        name,
        subdomain: `${cleanSlug}.meetthehub.com`,
      },
      admin: {
        id: adminId,
        name: adminName,
        userId: adminUserId,
      },
    });
  } catch (error) {
    console.error("Tenant signup error:", error);
    return ApiErrors.internal();
  }
}

// GET — Check if a slug is available
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return ApiErrors.badRequest("Slug parameter required");
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const reserved = ["admin", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];

  if (reserved.includes(cleanSlug)) {
    return apiSuccess({ available: false, reason: "reserved" });
  }

  const existing = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
  return apiSuccess({ available: !existing, slug: cleanSlug });
}
