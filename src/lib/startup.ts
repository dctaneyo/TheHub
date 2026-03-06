import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
const DATABASE_URL = process.env.DATABASE_URL || `file:${DB_PATH}`;

// Ensure data directory exists for local file databases
if (DATABASE_URL.startsWith("file:")) {
  const filePath = DATABASE_URL.slice(5);
  const dbDir = path.dirname(filePath);
  if (dbDir && !fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
}

async function run() {
  // Import our async sqlite wrapper
  const { sqlite } = await import("./db");

  // Check if DB has data
  let needsSeed = false;

  if (DATABASE_URL.startsWith("file:")) {
    const filePath = DATABASE_URL.slice(5);
    const dbExists = fs.existsSync(filePath);
    if (!dbExists) {
      needsSeed = true;
    } else {
      const stats = fs.statSync(filePath);
      if (stats.size < 10240) {
        needsSeed = true;
      } else {
        try {
          const result = await sqlite.prepare("SELECT COUNT(*) as count FROM arls").get() as any;
          needsSeed = !result || result.count === 0;
        } catch {
          needsSeed = true;
        }
      }
    }
  } else {
    // Remote DB (Turso) — check if arls table has data
    try {
      const result = await sqlite.prepare("SELECT COUNT(*) as count FROM arls").get() as any;
      needsSeed = !result || result.count === 0;
    } catch {
      needsSeed = true;
    }
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
      const { v4: uuid } = require("uuid");
      const now = new Date().toISOString();

      // Check if global chat exists
      let globalConv = await sqlite.prepare("SELECT id FROM conversations WHERE type = 'global' LIMIT 1").get() as any;

      if (!globalConv) {
        console.log("🌐 Creating Global Chat...");
        const globalConvId = uuid();
        await sqlite.prepare(
          "INSERT INTO conversations (id, type, name, created_at) VALUES (?, 'global', 'Global Chat', ?)"
        ).run(globalConvId, now);
        globalConv = { id: globalConvId };
      }

      const globalConvId = globalConv.id;

      // Ensure all locations are members
      const locations = await sqlite.prepare("SELECT id FROM locations").all() as any[];
      for (const loc of locations) {
        const existing = await sqlite.prepare(
          "SELECT id FROM conversation_members WHERE conversation_id = ? AND member_id = ? AND member_type = 'location'"
        ).get(globalConvId, loc.id);
        if (!existing) {
          await sqlite.prepare(
            "INSERT INTO conversation_members (id, conversation_id, member_id, member_type, joined_at) VALUES (?, ?, ?, 'location', ?)"
          ).run(uuid(), globalConvId, loc.id, now);
        }
      }

      // Ensure all ARLs are members
      const arls = await sqlite.prepare("SELECT id FROM arls").all() as any[];
      for (const arl of arls) {
        const existing = await sqlite.prepare(
          "SELECT id FROM conversation_members WHERE conversation_id = ? AND member_id = ? AND member_type = 'arl'"
        ).get(globalConvId, arl.id);
        if (!existing) {
          await sqlite.prepare(
            "INSERT INTO conversation_members (id, conversation_id, member_id, member_type, joined_at) VALUES (?, ?, ?, 'arl', ?)"
          ).run(uuid(), globalConvId, arl.id, now);
        }
      }

      console.log("✅ Global Chat migration complete");
    } catch (err) {
      console.error("Global Chat migration error:", err);
    }
  }
}

run().catch((err) => {
  console.error("Startup error:", err);
  process.exit(1);
});
