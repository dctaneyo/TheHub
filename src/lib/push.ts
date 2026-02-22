import webpush from "web-push";
import { db, schema } from "@/lib/db";
import { eq } from "drizzle-orm";

// Configure VAPID keys (you should generate these once and store in env)
const vapidKeys = {
  publicKey: process.env.VAPID_PUBLIC_KEY || "",
  privateKey: process.env.VAPID_PRIVATE_KEY || "",
  subject: "mailto:admin@thehub.app",
};

if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
  console.warn("VAPID keys not configured. Push notifications will not work.");
} else {
  webpush.setVapidDetails(vapidKeys.subject, vapidKeys.publicKey, vapidKeys.privateKey);
}

// Generate VAPID keys (run this once and save to env)
export function generateVAPIDKeys() {
  const keys = webpush.generateVAPIDKeys();
  console.log("VAPID Keys (add to your environment):");
  console.log("VAPID_PUBLIC_KEY=", keys.publicKey);
  console.log("VAPID_PRIVATE_KEY=", keys.privateKey);
  return keys;
}

// Send push notification to ALL ARL users (e.g. guest joining a meeting)
export async function sendPushToAllARLs(payload: {
  title: string;
  body: string;
  url?: string;
}) {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return;
  }

  try {
    const activeArls = db.select().from(schema.arls)
      .where(eq(schema.arls.isActive, true))
      .all();

    for (const arl of activeArls) {
      await sendPushToARL(arl.id, payload);
    }
  } catch (error) {
    console.error("Error sending push to all ARLs:", error);
  }
}

// Send push notification to an ARL user
export async function sendPushToARL(userId: string, payload: {
  title: string;
  body: string;
  url?: string;
  conversationId?: string;
}) {
  if (!vapidKeys.publicKey || !vapidKeys.privateKey) {
    console.warn("VAPID keys not configured, skipping push notification");
    return;
  }

  try {
    // Get all subscriptions for this ARL
    const subscriptions = db.select()
      .from(schema.pushSubscriptions)
      .where(eq(schema.pushSubscriptions.userId, userId))
      .all();

    if (subscriptions.length === 0) {
      console.log(`No push subscriptions found for ARL ${userId}`);
      return;
    }

    const pushPayload = JSON.stringify({
      title: payload.title,
      body: payload.body,
      url: payload.url || "/arl?tab=messaging",
      conversationId: payload.conversationId,
    });

    // Send to all subscriptions
    const results = await Promise.allSettled(
      subscriptions.map((sub) => {
        return webpush.sendNotification(
          {
            endpoint: sub.endpoint,
            keys: {
              p256dh: sub.p256dh,
              auth: sub.auth,
            },
          },
          pushPayload
        );
      })
    );

    // Remove failed subscriptions
    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      console.log(`Removing ${failed.length} failed push subscriptions`);
      const failedIndexes = failed.map((_, i) => i);
      const failedSubs = failedIndexes.map(i => subscriptions[i]);
      
      for (const failedSub of failedSubs) {
        db.delete(schema.pushSubscriptions)
          .where(eq(schema.pushSubscriptions.id, failedSub.id))
          .run();
      }
    }

    console.log(`Push notification sent to ${subscriptions.length - failed.length} devices for ARL ${userId}`);
  } catch (error) {
    console.error("Error sending push notification:", error);
  }
}
