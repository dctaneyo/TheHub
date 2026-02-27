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

  // ── Migration version tracking ──
  s.exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  function migrate(id: string, fn: () => void) {
    const exists = s.prepare(`SELECT 1 FROM _migrations WHERE id = ?`).get(id);
    if (exists) return;
    try {
      fn();
      s.prepare(`INSERT INTO _migrations (id) VALUES (?)`).run(id);
    } catch (err) {
      // Some migrations are idempotent (e.g. ADD COLUMN that already exists)
      // Still mark as applied to avoid re-running
      s.prepare(`INSERT OR IGNORE INTO _migrations (id) VALUES (?)`).run(id);
    }
  }

  // ── Legacy migrations (wrapped in version tracking) ──
  migrate("001_session_code", () => { s.exec(`ALTER TABLE sessions ADD COLUMN session_code TEXT`); });

  migrate("002_emergency_messages", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS emergency_messages (
      id TEXT PRIMARY KEY, message TEXT NOT NULL, sent_by TEXT NOT NULL,
      sent_by_name TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      target_location_ids TEXT, viewed_by TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, expires_at TEXT
    )`);
  });

  migrate("003_emergency_cols", () => {
    s.exec(`ALTER TABLE emergency_messages ADD COLUMN target_location_ids TEXT`);
    s.exec(`ALTER TABLE emergency_messages ADD COLUMN viewed_by TEXT NOT NULL DEFAULT '[]'`);
  });

  migrate("004_task_created_by_type", () => { s.exec(`ALTER TABLE tasks ADD COLUMN created_by_type TEXT NOT NULL DEFAULT 'arl'`); });

  migrate("005_push_subscriptions", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  migrate("006_sound_muted", () => { s.exec(`ALTER TABLE locations ADD COLUMN sound_muted INTEGER NOT NULL DEFAULT 0`); });
  migrate("007_biweekly_start", () => { s.exec(`ALTER TABLE tasks ADD COLUMN biweekly_start TEXT`); });
  migrate("008_file_content", () => { s.exec(`ALTER TABLE forms ADD COLUMN file_content BLOB`); });
  migrate("009_allow_early_complete", () => { s.exec(`ALTER TABLE tasks ADD COLUMN allow_early_complete INTEGER NOT NULL DEFAULT 0`); });
  migrate("010_current_page", () => { s.exec(`ALTER TABLE sessions ADD COLUMN current_page TEXT`); });
  migrate("011_show_in_today", () => { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_today INTEGER NOT NULL DEFAULT 1`); });
  migrate("012_show_in_7day", () => { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_7day INTEGER NOT NULL DEFAULT 1`); });
  migrate("013_show_in_calendar", () => { s.exec(`ALTER TABLE tasks ADD COLUMN show_in_calendar INTEGER NOT NULL DEFAULT 1`); });
  migrate("014_bonus_points", () => { s.exec(`ALTER TABLE task_completions ADD COLUMN bonus_points INTEGER NOT NULL DEFAULT 0`); });
  migrate("015_deleted_by", () => { s.exec(`ALTER TABLE conversations ADD COLUMN deleted_by TEXT NOT NULL DEFAULT '[]'`); });
  migrate("016_conv_created_by_type", () => { s.exec(`ALTER TABLE conversations ADD COLUMN created_by_type TEXT`); });

  migrate("017_message_reactions", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_type TEXT NOT NULL, user_name TEXT NOT NULL, emoji TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
  });

  migrate("018_reaction_cols", () => {
    s.exec(`ALTER TABLE message_reactions ADD COLUMN user_type TEXT NOT NULL DEFAULT 'location'`);
    s.exec(`ALTER TABLE message_reactions ADD COLUMN user_name TEXT NOT NULL DEFAULT 'Unknown'`);
  });

  migrate("019_pending_sessions", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS pending_sessions (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
      assigned_user_type TEXT, assigned_user_id TEXT, activated_by TEXT, token TEXT,
      redirect_to TEXT, user_agent TEXT, created_at TEXT NOT NULL, activated_at TEXT, expires_at TEXT NOT NULL
    )`);
  });

  migrate("020_scheduled_meetings", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS scheduled_meetings (
      id TEXT PRIMARY KEY, meeting_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT, password TEXT, host_id TEXT NOT NULL, host_name TEXT NOT NULL,
      scheduled_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 60,
      is_recurring INTEGER NOT NULL DEFAULT 0, recurring_type TEXT, recurring_days TEXT,
      allow_guests INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  migrate("021_meeting_participants", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY NOT NULL, meeting_id TEXT NOT NULL, participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL, participant_type TEXT NOT NULL, role TEXT NOT NULL,
      joined_at TEXT NOT NULL, left_at TEXT, duration INTEGER,
      had_video INTEGER NOT NULL DEFAULT 0, had_audio INTEGER NOT NULL DEFAULT 1,
      messages_sent INTEGER NOT NULL DEFAULT 0, questions_sent INTEGER NOT NULL DEFAULT 0,
      reactions_sent INTEGER NOT NULL DEFAULT 0, hand_raise_count INTEGER NOT NULL DEFAULT 0,
      was_muted_by_host INTEGER NOT NULL DEFAULT 0, connection_quality TEXT, device_type TEXT
    )`);
  });

  migrate("022_group_chat", () => {
    s.exec(`ALTER TABLE conversation_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`);
    s.exec(`ALTER TABLE conversation_members ADD COLUMN left_at TEXT`);
    s.exec(`ALTER TABLE conversations ADD COLUMN description TEXT`);
    s.exec(`ALTER TABLE conversations ADD COLUMN avatar_color TEXT`);
  });

  migrate("023_conversation_settings", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS conversation_settings (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_type TEXT NOT NULL, is_muted INTEGER NOT NULL DEFAULT 0,
      muted_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  migrate("024_assign_roles", () => {
    try {
      const membersWithoutRoles = s.prepare(
        `SELECT id, member_type FROM conversation_members WHERE role IS NULL`
      ).all() as Array<{ id: string; member_type: string }>;
      for (const member of membersWithoutRoles) {
        const role = member.member_type === "arl" ? "admin" : "member";
        s.prepare(`UPDATE conversation_members SET role = ? WHERE id = ?`).run(role, member.id);
      }
    } catch {}
  });

  migrate("025_message_metadata", () => { s.exec(`ALTER TABLE messages ADD COLUMN metadata TEXT`); });

  migrate("026_ticker_messages", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS ticker_messages (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📢',
      arl_id TEXT NOT NULL, arl_name TEXT NOT NULL, expires_at TEXT, created_at TEXT NOT NULL
    )`);
  });

  // Unique constraints to prevent duplicate records
  migrate("027_unique_task_completion", () => {
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_task_completion_unique ON task_completions(task_id, location_id, completed_date)`);
  });
  migrate("028_unique_message_read", () => {
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_unique ON message_reads(message_id, reader_id)`);
  });
  migrate("029_unique_conversation_member", () => {
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_member_unique ON conversation_members(conversation_id, member_id)`);
  });
  migrate("030_unique_message_reaction", () => {
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_unique ON message_reactions(message_id, user_id, emoji)`);
  });

  // Performance indexes (previously in add-indexes.ts script, now auto-applied)
  migrate("031_perf_indexes", () => {
    s.exec(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_task_completions_lookup ON task_completions(task_id, location_id, completed_date)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id)`);
  });

  const count = (s.prepare(`SELECT COUNT(*) as c FROM _migrations`).get() as any).c;
  console.log(`✅ Migrations complete (${count} applied)`);
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
