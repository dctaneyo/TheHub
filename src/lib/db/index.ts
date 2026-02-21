import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");

// Lazy singleton — only open DB on first access (avoids SQLite BUSY during build)
let _sqlite: InstanceType<typeof Database> | null = null;
let _db: ReturnType<typeof drizzle> | null = null;
let _migrated = false;

function getSqlite() {
  if (!_sqlite) {
    const dbDir = path.dirname(DB_PATH);
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }
    _sqlite = new Database(DB_PATH);
    _sqlite.pragma("journal_mode = WAL");
    _sqlite.pragma("foreign_keys = ON");
    _sqlite.pragma("busy_timeout = 5000");
  }
  return _sqlite;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getSqlite(), { schema });
  }
  if (!_migrated) {
    _migrated = true;
    runMigrations();
  }
  return _db;
}

function runMigrations() {
  const s = getSqlite();
  try { s.exec(`ALTER TABLE sessions ADD COLUMN session_code TEXT`); } catch {}
  try {
    s.exec(`CREATE TABLE IF NOT EXISTS emergency_messages (
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
  try { s.exec(`ALTER TABLE emergency_messages ADD COLUMN target_location_ids TEXT`); } catch {}
  try { s.exec(`ALTER TABLE emergency_messages ADD COLUMN viewed_by TEXT NOT NULL DEFAULT '[]'`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN created_by_type TEXT NOT NULL DEFAULT 'arl'`); } catch {}
  try {
    s.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL,
      auth TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  } catch {}
  try { s.exec(`ALTER TABLE locations ADD COLUMN sound_muted INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN biweekly_start TEXT`); } catch {}
  try { s.exec(`ALTER TABLE forms ADD COLUMN file_content BLOB`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN allow_early_complete INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { s.exec(`ALTER TABLE sessions ADD COLUMN current_page TEXT`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_today INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_7day INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_calendar INTEGER NOT NULL DEFAULT 1`); } catch {}
  try { s.exec(`ALTER TABLE task_completions ADD COLUMN bonus_points INTEGER NOT NULL DEFAULT 0`); } catch {}
  try { s.exec(`ALTER TABLE conversations ADD COLUMN deleted_by TEXT NOT NULL DEFAULT '[]'`); } catch {}
  try {
    s.exec(`CREATE TABLE IF NOT EXISTS pending_sessions (
      id TEXT PRIMARY KEY,
      code TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL DEFAULT 'pending',
      assigned_user_type TEXT,
      assigned_user_id TEXT,
      activated_by TEXT,
      token TEXT,
      redirect_to TEXT,
      user_agent TEXT,
      created_at TEXT NOT NULL,
      activated_at TEXT,
      expires_at TEXT NOT NULL
    )`);
  } catch {}
}

// Proxy objects so all existing `db.xxx` and `sqlite.xxx` calls work unchanged
export const db: ReturnType<typeof drizzle> = new Proxy({} as ReturnType<typeof drizzle>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export const sqlite: InstanceType<typeof Database> = new Proxy({} as InstanceType<typeof Database>, {
  get(_target, prop, receiver) {
    return Reflect.get(getSqlite(), prop, receiver);
  },
});

export { schema };
