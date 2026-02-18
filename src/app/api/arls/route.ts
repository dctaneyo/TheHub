import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }
    // Both ARLs and locations can fetch ARLs (for messaging)
    if (session.userType !== "arl" && session.userType !== "location") {
      return NextResponse.json({ error: "Not authorized" }, { status: 403 });
    }
    const arls = db.select({
      id: schema.arls.id,
      name: schema.arls.name,
      email: schema.arls.email,
      userId: schema.arls.userId,
      role: schema.arls.role,
      isActive: schema.arls.isActive,
      createdAt: schema.arls.createdAt,
    }).from(schema.arls).all();
    return NextResponse.json({ arls });
  } catch (error) {
    console.error("Get ARLs error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { name, email, userId, pin, role } = await req.json();
    if (!name || !userId || !pin || userId.length !== 6 || pin.length !== 6) {
      return NextResponse.json({ error: "name, 6-digit userId, and 6-digit pin required" }, { status: 400 });
    }
    const existing = db.select().from(schema.arls).where(eq(schema.arls.userId, userId)).get();
    if (existing) return NextResponse.json({ error: "User ID already taken" }, { status: 409 });

    const now = new Date().toISOString();
    const arl = { id: uuid(), name, email: email || null, userId, pinHash: hashSync(pin, 10), role: role || "arl", isActive: true, createdAt: now, updatedAt: now };
    db.insert(schema.arls).values(arl).run();
    return NextResponse.json({ success: true, arl: { ...arl, pinHash: undefined } });
  } catch (error) {
    console.error("Create ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id, name, email, pin, role, isActive } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

    const updates: Record<string, unknown> = { updatedAt: new Date().toISOString() };
    if (name !== undefined) updates.name = name;
    if (email !== undefined) updates.email = email;
    if (pin && pin.length === 6) updates.pinHash = hashSync(pin, 10);
    if (role !== undefined) updates.role = role;
    if (isActive !== undefined) updates.isActive = isActive;

    db.update(schema.arls).set(updates).where(eq(schema.arls.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Update ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.role !== "admin") {
      return NextResponse.json({ error: "Admin only" }, { status: 403 });
    }
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.update(schema.arls).set({ isActive: false }).where(eq(schema.arls.id, id)).run();
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Delete ARL error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
