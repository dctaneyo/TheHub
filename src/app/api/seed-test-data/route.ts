import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/db";
import { users, locations, arls } from "@/lib/db/schema";
import { eq } from "drizzle-orm";

export async function POST(request: NextRequest) {
  try {
    // Only allow this in development or with a special key
    const { seedKey } = await request.json();
    
    if (seedKey !== "seed-test-data-2024") {
      return NextResponse.json({ error: "Invalid seed key" }, { status: 403 });
    }

    // Create test location
    const testLocation = await db.insert(locations).values({
      name: "Test Store",
      storeNumber: "TEST001",
      address: "123 Test Street",
      city: "Test City",
      state: "TS",
      zipCode: "12345",
      isActive: true,
    }).returning();

    // Create test ARL
    const testArl = await db.insert(arls).values({
      name: "Test ARL",
      email: "arl@test.com",
      phone: "555-0123",
      region: "Test Region",
      isActive: true,
    }).returning();

    // Create test location user
    await db.insert(users).values({
      userId: "test-location",
      pin: "1234", // In production, this should be hashed
      userType: "location",
      name: "Test Location User",
      storeNumber: "TEST001",
      locationId: testLocation[0].id,
      isActive: true,
    });

    // Create test ARL user
    await db.insert(users).values({
      userId: "test-arl",
      pin: "1234", // In production, this should be hashed
      userType: "arl",
      name: "Test ARL User",
      arlId: testArl[0].id,
      isActive: true,
    });

    return NextResponse.json({ 
      success: true,
      message: "Test data seeded successfully",
      users: [
        { userId: "test-location", pin: "1234", type: "location" },
        { userId: "test-arl", pin: "1234", type: "arl" }
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