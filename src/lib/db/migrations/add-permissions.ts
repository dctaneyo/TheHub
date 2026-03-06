/**
 * Migration: Add `permissions` column to `arls` table
 * and set ARL with userId "2092" under Kazi tenant to admin role.
 *
 * Run with: npx tsx src/lib/db/migrations/add-permissions.ts
 */
import { sqlite } from "../index";

async function run() {
  // 1. Add `permissions` column if it doesn't exist
  const cols = await sqlite.prepare("PRAGMA table_info(arls)").all() as any[];
  if (!cols.some((c) => c.name === "permissions")) {
    await sqlite.execute(`ALTER TABLE arls ADD COLUMN permissions TEXT`);
    console.log("✅ Added `permissions` column to `arls` table");
  } else {
    console.log("ℹ️  `permissions` column already exists");
  }

  // 2. Promote userId "2092" under Kazi tenant to admin
  const result = await sqlite.prepare(
    `UPDATE arls SET role = 'admin' WHERE user_id = '2092' AND tenant_id = 'kazi'`
  ).run();
  if (result.changes > 0) {
    console.log("✅ Set ARL userId=2092 (Kazi tenant) to admin role");
  } else {
    console.log("⚠️  No ARL found with userId=2092 under Kazi tenant");
  }

  console.log("Done.");
}

run().catch((err) => {
  console.error("Migration error:", err);
  process.exit(1);
});
