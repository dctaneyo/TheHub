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
  // Check if _migrations table was corrupted by a bad deploy (wrong schema with INTEGER id + name column)
  const migTableInfo = s.prepare("PRAGMA table_info(_migrations)").all() as Array<{ name: string; type: string }>;
  const hasNameCol = migTableInfo.some((c) => c.name === "name");
  if (hasNameCol) {
    // Corrupted schema from bad migrate.js — drop and recreate with correct schema
    console.log("🔄 Repairing corrupted _migrations table...");
    s.exec(`DROP TABLE _migrations`);
  }
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

  // Ensure notifications table has all required columns
  // (table may have been created by an older schema missing user_id and other columns)
  migrate("026b_notifications_table", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT '', user_type TEXT NOT NULL DEFAULT 'location',
      type TEXT NOT NULL DEFAULT 'system', title TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
      action_url TEXT, action_label TEXT, priority TEXT NOT NULL DEFAULT 'normal',
      metadata TEXT, is_read INTEGER NOT NULL DEFAULT 0, read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    try { s.exec(`ALTER TABLE notifications ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN user_type TEXT NOT NULL DEFAULT 'location'`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'system'`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN title TEXT NOT NULL DEFAULT ''`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN message TEXT NOT NULL DEFAULT ''`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN action_url TEXT`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN action_label TEXT`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN metadata TEXT`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN read_at TEXT`); } catch {}
    try { s.exec(`ALTER TABLE notifications ADD COLUMN created_at TEXT`); } catch {}
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

  // Retry notifications index in case 031 silently failed due to missing user_id column
  migrate("032_notifications_index_retry", () => {
    s.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
  });

  // ── Multi-tenant migrations ──

  migrate("033_tenants_table", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS tenants (
      id TEXT PRIMARY KEY,
      slug TEXT NOT NULL UNIQUE,
      name TEXT NOT NULL,
      logo_url TEXT,
      primary_color TEXT NOT NULL DEFAULT '#dc2626',
      accent_color TEXT,
      favicon_url TEXT,
      app_title TEXT,
      plan TEXT NOT NULL DEFAULT 'starter',
      features TEXT NOT NULL DEFAULT '["messaging","tasks","forms","gamification","meetings","analytics","broadcasts"]',
      max_locations INTEGER NOT NULL DEFAULT 50,
      max_users INTEGER NOT NULL DEFAULT 20,
      is_active INTEGER NOT NULL DEFAULT 1,
      custom_domain TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
  });

  migrate("034_seed_kazi_tenant", () => {
    const now = new Date().toISOString();
    s.prepare(`INSERT OR IGNORE INTO tenants (id, slug, name, app_title, plan, features, max_locations, max_users, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .run("kazi", "kazi", "Kazi Franchise", "The Hub", "enterprise",
        '["messaging","tasks","forms","gamification","meetings","analytics","broadcasts"]',
        100, 50, 1, now, now);
  });

  // Add tenant_id columns to all existing tables and backfill with 'kazi'
  const tenantTables = [
    "locations", "arls", "tasks", "conversations", "forms",
    "daily_leaderboard", "emergency_messages", "notifications",
    "broadcasts", "meeting_analytics", "ticker_messages",
  ];
  migrate("035_add_tenant_id_columns", () => {
    for (const table of tenantTables) {
      try { s.exec(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'kazi'`); } catch {}
    }
  });

  migrate("036_backfill_tenant_id", () => {
    for (const table of tenantTables) {
      try { s.exec(`UPDATE ${table} SET tenant_id = 'kazi' WHERE tenant_id IS NULL OR tenant_id = ''`); } catch {}
    }
  });

  migrate("037_tenant_id_indexes", () => {
    for (const table of tenantTables) {
      try { s.exec(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`); } catch {}
    }
  });

  // Remove unique constraint on locations.store_number (now unique per tenant, not globally)
  // SQLite doesn't support DROP INDEX on unique constraints easily, so we use a composite index instead
  migrate("038_tenant_composite_indexes", () => {
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_tenant_store ON locations(tenant_id, store_number)`);
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_tenant_userid ON locations(tenant_id, user_id)`);
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_arls_tenant_userid ON arls(tenant_id, user_id)`);
  });

  // ── ARL Permissions system ──
  migrate("039_arl_permissions", () => {
    try { s.exec(`ALTER TABLE arls ADD COLUMN permissions TEXT`); } catch {}
    // Promote userId "2092" under Kazi tenant to admin
    s.prepare(`UPDATE arls SET role = 'admin' WHERE user_id = '2092' AND tenant_id = 'kazi'`).run();
  });

  // ── Foreign key & query performance indexes ──
  migrate("040_fk_indexes", () => {
    // task_completions lookups by location
    s.exec(`CREATE INDEX IF NOT EXISTS idx_task_completions_location ON task_completions(location_id)`);
    // message_reads by reader (for unread count queries)
    s.exec(`CREATE INDEX IF NOT EXISTS idx_message_reads_reader ON message_reads(reader_id, reader_type)`);
    // conversation_members by member (for "my conversations" queries)
    s.exec(`CREATE INDEX IF NOT EXISTS idx_conv_members_member ON conversation_members(member_id, member_type)`);
    // messages by sender (for search / activity queries)
    s.exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
    // push_subscriptions by user
    s.exec(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);
    // sessions expiry (for cleanup queries)
    s.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
    // pending_sessions expiry
    s.exec(`CREATE INDEX IF NOT EXISTS idx_pending_sessions_expires ON pending_sessions(expires_at)`);
    // emergency_messages tenant + active
    s.exec(`CREATE INDEX IF NOT EXISTS idx_emergency_tenant_active ON emergency_messages(tenant_id, is_active)`);
    // broadcasts by tenant + arl
    s.exec(`CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id)`);
    // ticker messages expiry
    s.exec(`CREATE INDEX IF NOT EXISTS idx_ticker_expires ON ticker_messages(expires_at)`);
  });

  // ── RBAC: Roles table + ARL location-scoping ──
  migrate("041_roles_table", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id)`);
  });

  migrate("042_arl_role_id_and_locations", () => {
    try { s.exec(`ALTER TABLE arls ADD COLUMN role_id TEXT`); } catch {}
    try { s.exec(`ALTER TABLE arls ADD COLUMN assigned_location_ids TEXT`); } catch {}
  });

  migrate("043_seed_default_roles", () => {
    const now = new Date().toISOString();
    const defaults = [
      {
        id: "role-full-access",
        name: "Full Access",
        description: "All permissions enabled — same as admin but without admin privileges",
        permissions: JSON.stringify([
          "locations.create","locations.delete","locations.edit","arls.create","arls.delete","arls.edit",
          "tasks.create","tasks.delete","tasks.edit","locations.mute","locations.reset_pin",
          "meetings.start","meetings.schedule","meetings.delete","meetings.edit",
          "emergency.access","data_management.access","forms.upload","forms.delete",
          "ticker.create","ticker.delete","analytics.access","gamification.send"
        ]),
      },
      {
        id: "role-area-coach",
        name: "Area Coach",
        description: "Manage tasks and locations, no user management",
        permissions: JSON.stringify([
          "tasks.create","tasks.delete","tasks.edit","locations.mute","locations.reset_pin",
          "meetings.start","meetings.schedule","forms.upload","forms.delete",
          "ticker.create","ticker.delete","analytics.access","gamification.send"
        ]),
      },
      {
        id: "role-read-only",
        name: "Read Only",
        description: "View-only access — no create, edit, or delete permissions",
        permissions: JSON.stringify(["analytics.access"]),
      },
      {
        id: "role-task-manager",
        name: "Task Manager",
        description: "Create and manage tasks only",
        permissions: JSON.stringify(["tasks.create","tasks.delete","tasks.edit","analytics.access"]),
      },
    ];
    for (const role of defaults) {
      s.prepare(`INSERT OR IGNORE INTO roles (id, tenant_id, name, description, permissions, is_default, created_at, updated_at)
        VALUES (?, 'kazi', ?, ?, ?, 1, ?, ?)`).run(role.id, role.name, role.description, role.permissions, now, now);
    }
  });

  // ── Location Groups / Regions ──
  migrate("044_location_groups", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS location_groups (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    s.exec(`CREATE TABLE IF NOT EXISTS location_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_location_groups_tenant ON location_groups(tenant_id)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_lgm_group ON location_group_members(group_id)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_lgm_location ON location_group_members(location_id)`);
    s.exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lgm_unique ON location_group_members(group_id, location_id)`);
  });

  // ── Scheduled Reports ──
  migrate("045_scheduled_reports", () => {
    s.exec(`CREATE TABLE IF NOT EXISTS scheduled_reports (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      name TEXT NOT NULL,
      type TEXT NOT NULL,
      frequency TEXT NOT NULL,
      recipients TEXT NOT NULL,
      filters TEXT,
      last_run_at TEXT,
      next_run_at TEXT,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_by TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    s.exec(`CREATE TABLE IF NOT EXISTS report_history (
      id TEXT PRIMARY KEY,
      report_id TEXT NOT NULL,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      status TEXT NOT NULL DEFAULT 'pending',
      file_path TEXT,
      file_content BLOB,
      error TEXT,
      created_at TEXT NOT NULL,
      completed_at TEXT
    )`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id)`);
  });

  // ── Fix notifications table: old schema had location_id NOT NULL which breaks createNotification ──
  migrate("046_rebuild_notifications_table", () => {
    // Check if the old location_id column exists
    const cols = s.prepare(`PRAGMA table_info(notifications)`).all() as Array<{ name: string }>;
    const hasLocationId = cols.some((c) => c.name === "location_id");
    if (!hasLocationId) return; // Already on new schema

    // Rebuild: copy data, drop old table, create new, copy back
    s.exec(`ALTER TABLE notifications RENAME TO _notifications_old`);
    s.exec(`CREATE TABLE notifications (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      user_id TEXT NOT NULL DEFAULT '',
      user_type TEXT NOT NULL DEFAULT 'location',
      type TEXT NOT NULL DEFAULT 'system',
      title TEXT NOT NULL DEFAULT '',
      message TEXT NOT NULL DEFAULT '',
      action_url TEXT,
      action_label TEXT,
      priority TEXT NOT NULL DEFAULT 'normal',
      metadata TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    // Migrate existing data — map old columns to new where possible
    s.exec(`INSERT INTO notifications (id, tenant_id, user_id, user_type, type, title, message, is_read, created_at)
      SELECT id,
        COALESCE(tenant_id, 'kazi'),
        COALESCE(user_id, location_id, ''),
        COALESCE(user_type, 'location'),
        COALESCE(type, 'system'),
        COALESCE(title, ''),
        COALESCE(message, body, ''),
        COALESCE(is_read, 0),
        COALESCE(created_at, datetime('now'))
      FROM _notifications_old`);
    s.exec(`DROP TABLE _notifications_old`);
    // Re-create indexes
    s.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
    s.exec(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id)`);
  });

  // ── Dashboard layout preference (persisted per user) ──
  migrate("047_dashboard_layout", () => {
    try { s.exec(`ALTER TABLE locations ADD COLUMN dashboard_layout TEXT NOT NULL DEFAULT 'classic'`); } catch {}
    try { s.exec(`ALTER TABLE arls ADD COLUMN dashboard_layout TEXT NOT NULL DEFAULT 'classic'`); } catch {}
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
