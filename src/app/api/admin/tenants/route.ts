import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { v4 as uuid } from "uuid";

const ADMIN_SECRET = process.env.ADMIN_SECRET;

async function requireAdmin(): Promise<NextResponse | null> {
  if (!ADMIN_SECRET) {
    return NextResponse.json({ error: "Admin not configured" }, { status: 503 });
  }
  const cookieStore = await cookies();
  const token = cookieStore.get("hub-admin-token")?.value;
  if (!token || token !== ADMIN_SECRET) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null; // authorized
}

// GET all tenants with stats
export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const allTenants = db.select().from(schema.tenants).all();

    const tenants = allTenants.map((t) => {
      const locationCount = db
        .select()
        .from(schema.locations)
        .where(eq(schema.locations.tenantId, t.id))
        .all().length;
      const userCount = db
        .select()
        .from(schema.arls)
        .where(eq(schema.arls.tenantId, t.id))
        .all().length;

      return {
        ...t,
        features: JSON.parse(t.features || "[]"),
        locationCount,
        userCount,
      };
    });

    return NextResponse.json({ tenants });
  } catch (error) {
    console.error("Get tenants error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// POST create new tenant
export async function POST(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { slug, name, appTitle, primaryColor, plan, features, maxLocations, maxUsers, customDomain } = body;

    if (!slug || !name) {
      return NextResponse.json({ error: "Slug and name are required" }, { status: 400 });
    }

    // Check slug uniqueness
    const existing = db.select().from(schema.tenants).where(eq(schema.tenants.slug, slug)).get();
    if (existing) {
      return NextResponse.json({ error: "Slug already exists" }, { status: 409 });
    }

    const now = new Date().toISOString();
    const id = slug; // Use slug as ID for simplicity (matches middleware lookup)

    db.insert(schema.tenants).values({
      id,
      slug,
      name,
      appTitle: appTitle || null,
      primaryColor: primaryColor || "#dc2626",
      plan: plan || "starter",
      features: JSON.stringify(features || []),
      maxLocations: maxLocations || 50,
      maxUsers: maxUsers || 20,
      isActive: true,
      customDomain: customDomain || null,
      createdAt: now,
      updatedAt: now,
    }).run();

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error("Create tenant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// PUT update tenant
export async function PUT(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const body = await req.json();
    const { id, name, appTitle, primaryColor, plan, features, maxLocations, maxUsers, customDomain, isActive } = body;

    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (appTitle !== undefined) updates.appTitle = appTitle;
    if (primaryColor !== undefined) updates.primaryColor = primaryColor;
    if (plan !== undefined) updates.plan = plan;
    if (features !== undefined) updates.features = JSON.stringify(features);
    if (maxLocations !== undefined) updates.maxLocations = maxLocations;
    if (maxUsers !== undefined) updates.maxUsers = maxUsers;
    if (customDomain !== undefined) updates.customDomain = customDomain;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.tenants).set(updates).where(eq(schema.tenants.id, id)).run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update tenant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

// DELETE tenant
export async function DELETE(req: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "ID required" }, { status: 400 });

    // Prevent deleting the seed tenant
    if (id === "kazi") {
      return NextResponse.json({ error: "Cannot delete the primary tenant" }, { status: 403 });
    }

    // Soft-delete: just mark inactive
    db.update(schema.tenants)
      .set({ isActive: false, updatedAt: new Date().toISOString() })
      .where(eq(schema.tenants.id, id))
      .run();

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete tenant error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
