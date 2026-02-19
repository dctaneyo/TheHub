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
  seed.on("exit", (code: number) => {
    if (code !== 0) {
      console.error("Seed failed");
      process.exit(1);
    }
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
