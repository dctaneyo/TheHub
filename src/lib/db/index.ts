import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");

// Ensure the data directory exists
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);

// Enable WAL mode for better concurrent read performance
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");

export const db = drizzle(sqlite, { schema });
export { schema };
export { sqlite };

// Runtime migrations - safely add new columns/tables to existing DBs
try { sqlite.exec(`ALTER TABLE sessions ADD COLUMN session_code TEXT`); } catch {}
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS emergency_messages (
    id TEXT PRIMARY KEY,
    message TEXT NOT NULL,
    sent_by TEXT NOT NULL,
    sent_by_name TEXT NOT NULL,
    is_active INTEGER NOT NULL DEFAULT 1,
    target_location_ids TEXT,
    viewed_by TEXT NOT NULL DEFAULT '[]',
    created_at TEXT NOT NULL,
    expires_at TEXT
  )`);
} catch {}
try { sqlite.exec(`ALTER TABLE emergency_messages ADD COLUMN target_location_ids TEXT`); } catch {}
try { sqlite.exec(`ALTER TABLE emergency_messages ADD COLUMN viewed_by TEXT NOT NULL DEFAULT '[]'`); } catch {}
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN created_by_type TEXT NOT NULL DEFAULT 'arl'`); } catch {}
try {
  sqlite.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    endpoint TEXT NOT NULL,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  )`);
} catch {}
try { sqlite.exec(`ALTER TABLE tasks ADD COLUMN biweekly_start TEXT`); } catch {}
