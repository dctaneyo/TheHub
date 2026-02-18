import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const subscription = await req.json();
    if (!subscription.endpoint) {
      return NextResponse.json({ error: "Invalid subscription" }, { status: 400 });
    }

    // Store or update subscription for this ARL
    const existing = db.select().from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, session.id))
      .get();

    if (existing) {
      db.update(schema.pushSubscriptions)
        .set({ 
          endpoint: subscription.endpoint,
          p256dh: subscription.keys.p256dh,
          auth: subscription.keys.auth,
          updatedAt: new Date().toISOString()
        })
        .where(eq(schema.pushSubscriptions.id, existing.id))
        .run();
    } else {
      db.insert(schema.pushSubscriptions).values({
        id: crypto.randomUUID(),
        userId: session.id,
        endpoint: subscription.endpoint,
        p256dh: subscription.keys.p256dh,
        auth: subscription.keys.auth,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      }).run();
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Push subscription error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
