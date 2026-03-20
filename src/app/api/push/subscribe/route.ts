import { NextRequest, NextResponse } from "next/server";
import { getAuthSession, unauthorized } from "@/lib/api-helpers";
import { db, schema } from "@/lib/db";
import { eq, and } from "drizzle-orm";
import { apiSuccess, ApiErrors } from "@/lib/api-response";

export async function POST(req: NextRequest) {
  try {
    const session = await getAuthSession();
    if (!session || session.userType !== "arl") {
      return ApiErrors.unauthorized();
    }

    const subscription = await req.json();
    if (!subscription.endpoint) {
      return ApiErrors.badRequest("Invalid subscription");
    }

    // Store or update subscription for this ARL — keyed by endpoint (unique per device)
    // This allows multiple devices per ARL to receive push notifications
    const existing = db.select().from(schema.pushSubscriptions)
      .where(and(
        eq(schema.pushSubscriptions.userId, session.id),
        eq(schema.pushSubscriptions.endpoint, subscription.endpoint)
      ))
      .get();

    if (existing) {
      db.update(schema.pushSubscriptions)
        .set({ 
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

    return apiSuccess({ success: true });
  } catch (error) {
    console.error("Push subscription error:", error);
    return ApiErrors.internal();
  }
}
