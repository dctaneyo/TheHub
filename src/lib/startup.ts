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
}
