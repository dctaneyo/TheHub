import { NextRequest, NextResponse } from "next/server";
import { db, schema, sqlite } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";
import bcrypt from "bcryptjs";

const ALL_FEATURES = ["messaging", "tasks", "forms", "gamification", "meetings", "analytics", "broadcasts"];

const PLAN_LIMITS: Record<string, { maxLocations: number; maxUsers: number }> = {
  starter: { maxLocations: 10, maxUsers: 5 },
  pro: { maxLocations: 50, maxUsers: 20 },
  enterprise: { maxLocations: 500, maxUsers: 100 },
};

export async function POST(req: NextRequest) {
  try {
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
      return NextResponse.json(
        { error: "All fields are required: slug, name, adminName, adminUserId, adminPin" },
        { status: 400 }
      );
    }

    // Slug format: lowercase, alphanumeric + hyphens, 3-30 chars
    const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
    if (cleanSlug.length < 3 || cleanSlug.length > 30) {
      return NextResponse.json(
        { error: "Slug must be 3-30 characters (lowercase letters, numbers, hyphens)" },
        { status: 400 }
      );
    }

    // Reserved slugs
    const reserved = ["admin", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];
    if (reserved.includes(cleanSlug)) {
      return NextResponse.json({ error: "This subdomain is reserved" }, { status: 400 });
    }

    // Admin userId: 4 digits
    if (!/^\d{4}$/.test(adminUserId)) {
      return NextResponse.json({ error: "Admin user ID must be exactly 4 digits" }, { status: 400 });
    }

    // Admin PIN: 4 digits
    if (!/^\d{4}$/.test(adminPin)) {
      return NextResponse.json({ error: "Admin PIN must be exactly 4 digits" }, { status: 400 });
    }

    // ── Check uniqueness ──
    const existingTenant = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
    if (existingTenant) {
      return NextResponse.json({ error: "This subdomain is already taken" }, { status: 409 });
    }

    // Check if adminUserId is globally unique
    const existingArl = db.select().from(schema.arls).where(eq(schema.arls.userId, adminUserId)).get();
    const existingLoc = db.select().from(schema.locations).where(eq(schema.locations.userId, adminUserId)).get();
    if (existingArl || existingLoc) {
      return NextResponse.json({ error: "This user ID is already in use" }, { status: 409 });
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

    return NextResponse.json({
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
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// GET — Check if a slug is available
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const slug = searchParams.get("slug");

  if (!slug) {
    return NextResponse.json({ error: "Slug parameter required" }, { status: 400 });
  }

  const cleanSlug = slug.toLowerCase().replace(/[^a-z0-9-]/g, "");
  const reserved = ["admin", "www", "join", "api", "app", "hub", "mail", "ftp", "ns1", "ns2", "test", "staging", "dev"];

  if (reserved.includes(cleanSlug)) {
    return NextResponse.json({ available: false, reason: "reserved" });
  }

  const existing = db.select().from(schema.tenants).where(eq(schema.tenants.slug, cleanSlug)).get();
  return NextResponse.json({ available: !existing, slug: cleanSlug });
}
