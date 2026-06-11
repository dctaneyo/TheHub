import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { locations, arls } from "@/lib/db/schema";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";

export async function POST(request: NextRequest) {
  try {
    // Only allow this in development or with a special key
    const { seedKey } = await request.json();
    
    if (seedKey !== "seed-test-data-2024") {
      return NextResponse.json({ error: "Invalid seed key" }, { status: 403 });
    }

    // Create test location with 4-digit User ID and PIN
    await db.insert(locations).values({
      id: uuid(),
      tenantId: "kazi",
      name: "Test Store",
      storeNumber: "TEST001",
      userId: "1111", // 4-digit User ID
      pinHash: hashSync("1111", 10), // 4-digit PIN hashed
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    // Create test ARL with 4-digit User ID and PIN
    await db.insert(arls).values({
      id: uuid(),
      tenantId: "kazi",
      name: "Test ARL",
      email: "arl@test.com",
      userId: "2222", // 4-digit User ID
      pinHash: hashSync("2222", 10), // 4-digit PIN hashed
      isActive: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });

    return NextResponse.json({ 
      success: true,
      message: "Test data seeded successfully",
      users: [
        { userId: "1111", pin: "1111", type: "location", name: "Test Store" },
        { userId: "2222", pin: "2222", type: "arl", name: "Test ARL" }
      ]
    });

  } catch (error) {
    console.error("Seed error:", error);
    return NextResponse.json({ 
      error: "Failed to seed data",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}