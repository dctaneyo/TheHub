/**
 * Migration: Add `permissions` column to `arls` table
 * and set ARL with userId "2092" under Kazi tenant to admin role.
 *
 * Run with: npx tsx src/lib/db/migrations/add-permissions.ts
 */
import Database from "better-sqlite3";
import path from "path";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
const db = new Database(DB_PATH);

// 1. Add `permissions` column if it doesn't exist
const cols = db.pragma("table_info(arls)") as Array<{ name: string }>;
if (!cols.some((c) => c.name === "permissions")) {
  db.exec(`ALTER TABLE arls ADD COLUMN permissions TEXT`);
  console.log("✅ Added `permissions` column to `arls` table");
} else {
  console.log("ℹ️  `permissions` column already exists");
}

// 2. Promote userId "2092" under Kazi tenant to admin
const result = db
  .prepare(`UPDATE arls SET role = 'admin' WHERE user_id = '2092' AND tenant_id = 'kazi'`)
  .run();
if (result.changes > 0) {
  console.log("✅ Set ARL userId=2092 (Kazi tenant) to admin role");
} else {
  console.log("⚠️  No ARL found with userId=2092 under Kazi tenant");
}

db.close();
console.log("Done.");
