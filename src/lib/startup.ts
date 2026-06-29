import Database from "better-sqlite3";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");

// Ensure data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Check if DB exists and has data
const dbExists = fs.existsSync(DB_PATH);
let needsSeed = false;

if (dbExists) {
  const stats = fs.statSync(DB_PATH);
  // If DB file is very small (< 10KB), it's probably empty (no tables)
  if (stats.size < 10240) {
    needsSeed = true;
  } else {
    try {
      const sqlite = new Database(DB_PATH, { readonly: true });
      const result = sqlite.prepare("SELECT COUNT(*) as count FROM arls").get() as { count: number };
      needsSeed = result.count === 0;
      sqlite.close();
    } catch {
      // DB exists but has no tables or is corrupted, needs seed
      needsSeed = true;
    }
  }
} else {
  needsSeed = true;
}

if (needsSeed) {
  console.log("🌱 Database not found or empty, running seed...");
  const { spawn } = require("child_process");
  const seed = spawn("npm", ["run", "db:seed"], { stdio: "inherit" });
  
  // Add timeout to prevent hanging
  const timeout = setTimeout(() => {
    console.error("Seed process timed out after 60 seconds");
    seed.kill("SIGTERM");
    process.exit(1);
  }, 60000);
  
  seed.on("exit", (code: number) => {
    clearTimeout(timeout);
    if (code !== 0) {
      console.error("Seed failed with exit code:", code);
      process.exit(1);
    }
    console.log("✅ Seed completed successfully");
  });
  
  seed.on("error", (err: any) => {
    clearTimeout(timeout);
    console.error("Seed process error:", err);
    process.exit(1);
  });
} else {
  console.log("✅ Database already initialized, skipping seed");

  // Ensure Global Chat exists and all locations/ARLs are members
  try {
    const sqlite = new Database(DB_PATH);
    const { v4: uuid } = require("uuid");
    const now = new Date().toISOString();

    // Check if global chat exists
    let globalConv = sqlite.prepare("SELECT id FROM conversations WHERE type = 'global' LIMIT 1").get() as { id: string } | undefined;

    if (!globalConv) {
      console.log("🌐 Creating Global Chat...");
      const globalConvId = uuid();
      sqlite.prepare(
        "INSERT INTO conversations (id, type, name, created_at) VALUES (?, 'global', 'Global Chat', ?)"
      ).run(globalConvId, now);
      globalConv = { id: globalConvId };
    }

    const globalConvId = globalConv.id;

    // Ensure all locations are members
    const locations = sqlite.prepare("SELECT id FROM locations").all() as { id: string }[];
    for (const loc of locations) {
      const existing = sqlite.prepare(
        "SELECT id FROM conversation_members WHERE conversation_id = ? AND member_id = ? AND member_type = 'location'"
      ).get(globalConvId, loc.id);
      if (!existing) {
        sqlite.prepare(
          "INSERT INTO conversation_members (id, conversation_id, member_id, member_type, joined_at) VALUES (?, ?, ?, 'location', ?)"
        ).run(uuid(), globalConvId, loc.id, now);
      }
    }

    // Ensure all ARLs are members
    const arls = sqlite.prepare("SELECT id FROM arls").all() as { id: string }[];
    for (const arl of arls) {
      const existing = sqlite.prepare(
        "SELECT id FROM conversation_members WHERE conversation_id = ? AND member_id = ? AND member_type = 'arl'"
      ).get(globalConvId, arl.id);
      if (!existing) {
        sqlite.prepare(
          "INSERT INTO conversation_members (id, conversation_id, member_id, member_type, joined_at) VALUES (?, ?, ?, 'arl', ?)"
        ).run(uuid(), globalConvId, arl.id, now);
      }
    }

    sqlite.close();
    console.log("✅ Global Chat migration complete");
  } catch (err) {
    console.error("Global Chat migration error:", err);
  }
}

// ── First platform admin (Admin Console) ──────────────────────────────────
// The Admin Console has no self-serve signup — every account after the first
// is created from /admin/team, but the very first one needs a way in. On a
// fresh deploy nobody can SSH in to run scripts/seed-admin.ts, so we seed it
// from environment variables here instead. Idempotent and first-admin-only:
// if ANY platform admin already exists we never touch the table, so this can
// never clobber a real account or reset a password on a later redeploy.
function seedFirstAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL?.trim();
  const name = process.env.SEED_ADMIN_NAME?.trim();
  const password = process.env.SEED_ADMIN_PASSWORD;
  const pin = process.env.SEED_ADMIN_PIN;

  // No config → nothing to do. (Once the first admin exists you can safely
  // remove these env vars; they're only read on a from-empty deploy.)
  if (!email && !name && !password && !pin) return;

  if (!email || !name || !password || !pin) {
    console.warn("⚠️  SEED_ADMIN_* partially set — need EMAIL, NAME, PASSWORD and PIN together. Skipping admin seed.");
    return;
  }
  if (!/^\d{6}$/.test(pin)) {
    console.warn("⚠️  SEED_ADMIN_PIN must be exactly 6 digits. Skipping admin seed.");
    return;
  }

  let sqlite: InstanceType<typeof Database> | null = null;
  try {
    sqlite = new Database(DB_PATH);

    // The platform_admins table is otherwise created by a programmatic
    // migration that only runs once the Next server first touches the DB —
    // i.e. after this startup script. Create it here (idempotently) so the
    // first-boot seed doesn't race that migration. DDL mirrors schema.ts.
    sqlite.exec(`CREATE TABLE IF NOT EXISTS platform_admins (
      id TEXT PRIMARY KEY,
      email TEXT NOT NULL UNIQUE,
      password_hash TEXT NOT NULL,
      pin_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);

    const existing = sqlite.prepare("SELECT COUNT(*) as count FROM platform_admins").get() as { count: number };
    if (existing.count > 0) {
      console.log("✅ Platform admin already exists, skipping admin seed");
      return;
    }

    const { hashSync } = require("bcryptjs");
    const { v4: uuid } = require("uuid");
    const now = new Date().toISOString();

    sqlite.prepare(
      `INSERT INTO platform_admins (id, email, password_hash, pin_hash, name, is_active, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, 1, ?, ?)`
    ).run(uuid(), email, hashSync(password, 10), hashSync(pin, 10), name, now, now);

    console.log(`🔑 Seeded first platform admin: ${name} <${email}>`);
  } catch (err) {
    console.error("Admin seed error:", err);
  } finally {
    sqlite?.close();
  }
}

seedFirstAdmin();
