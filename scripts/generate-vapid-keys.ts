#!/usr/bin/env tsx
import { generateVAPIDKeys } from "../src/lib/push";

console.log("Generating VAPID keys for push notifications...");
generateVAPIDKeys();
console.log("\nAdd these to your Railway environment variables:");
console.log("- VAPID_PUBLIC_KEY");
console.log("- VAPID_PRIVATE_KEY");
console.log("- NEXT_PUBLIC_VAPID_PUBLIC_KEY (same as VAPID_PUBLIC_KEY)");
