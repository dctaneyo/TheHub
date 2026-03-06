import { drizzle } from "drizzle-orm/libsql";
import { createClient, type Client } from "@libsql/client";
import * as schema from "./schema";
import path from "path";
import fs from "fs";

// Support both local file: URLs and remote libsql:// URLs (e.g. Turso)
const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
// If DATABASE_URL is set, use it directly. Otherwise derive from DATABASE_PATH.
// If DATABASE_PATH is already a remote URL (libsql:// or https://), use it as-is.
const DATABASE_URL = process.env.DATABASE_URL
  || (DB_PATH.startsWith("libsql://") || DB_PATH.startsWith("https://") || DB_PATH.startsWith("file:")
    ? DB_PATH
    : `file:${DB_PATH}`);

// Lazy singleton — only open DB on first access (avoids issues during build)
let _client: Client | null = null;
let _db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let _migrated = false;

function getClient(): Client {
  if (!_client) {
    // Ensure data directory exists for local file databases
    if (DATABASE_URL.startsWith("file:")) {
      const filePath = DATABASE_URL.slice(5); // remove "file:"
      const dbDir = path.dirname(filePath);
      if (dbDir && !fs.existsSync(dbDir)) {
        fs.mkdirSync(dbDir, { recursive: true });
      }
    }
    _client = createClient({
      url: DATABASE_URL,
      authToken: process.env.DATABASE_AUTH_TOKEN || undefined,
    });
  }
  return _client;
}

function getDb() {
  if (!_db) {
    _db = drizzle(getClient(), { schema });
  }
  return _db;
}

// ── Raw SQL compatibility wrapper (async, matches better-sqlite3 API shape) ──
// Usage: await sqlite.execute("SQL"); await sqlite.prepare("SQL ?").run(arg); etc.
export const sqlite = {
  async execute(sql: string) {
    return getClient().execute(sql);
  },
  prepare(sql: string) {
    const c = getClient();
    return {
      async run(...args: any[]) { const r = await c.execute({ sql, args }); return { ...r, changes: r.rowsAffected }; },
      async all(...args: any[]) { return (await c.execute({ sql, args })).rows; },
      async get(...args: any[]) { return (await c.execute({ sql, args })).rows[0] ?? null; },
    };
  },
};

// ── Migrations ──
export async function runMigrations() {
  if (_migrated) return;
  _migrated = true;

  const c = getClient();

  // Helper: execute a single SQL statement
  const exec = (sql: string) => c.execute(sql);
  const run = (sql: string, ...args: any[]) => c.execute({ sql, args });
  const get = async (sql: string, ...args: any[]) => (await c.execute({ sql, args })).rows[0] ?? null;
  const all = async (sql: string, ...args: any[]) => (await c.execute({ sql, args })).rows;

  // ── Migration version tracking ──
  await exec(`CREATE TABLE IF NOT EXISTS _migrations (
    id TEXT PRIMARY KEY,
    applied_at TEXT NOT NULL DEFAULT (datetime('now'))
  )`);

  async function migrate(id: string, fn: () => Promise<void>) {
    const exists = await get(`SELECT 1 FROM _migrations WHERE id = ?`, id);
    if (exists) return;
    try {
      await fn();
      await run(`INSERT INTO _migrations (id) VALUES (?)`, id);
    } catch (err) {
      // Some migrations are idempotent (e.g. ADD COLUMN that already exists)
      // Still mark as applied to avoid re-running
      await run(`INSERT OR IGNORE INTO _migrations (id) VALUES (?)`, id);
    }
  }

  // ── Legacy migrations (wrapped in version tracking) ──
  await migrate("001_session_code", async () => { await exec(`ALTER TABLE sessions ADD COLUMN session_code TEXT`); });

  await migrate("002_emergency_messages", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS emergency_messages (
      id TEXT PRIMARY KEY, message TEXT NOT NULL, sent_by TEXT NOT NULL,
      sent_by_name TEXT NOT NULL, is_active INTEGER NOT NULL DEFAULT 1,
      target_location_ids TEXT, viewed_by TEXT NOT NULL DEFAULT '[]',
      created_at TEXT NOT NULL, expires_at TEXT
    )`);
  });

  await migrate("003_emergency_cols", async () => {
    await exec(`ALTER TABLE emergency_messages ADD COLUMN target_location_ids TEXT`);
    await exec(`ALTER TABLE emergency_messages ADD COLUMN viewed_by TEXT NOT NULL DEFAULT '[]'`);
  });

  await migrate("004_task_created_by_type", async () => { await exec(`ALTER TABLE tasks ADD COLUMN created_by_type TEXT NOT NULL DEFAULT 'arl'`); });

  await migrate("005_push_subscriptions", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS push_subscriptions (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL, endpoint TEXT NOT NULL,
      p256dh TEXT NOT NULL, auth TEXT NOT NULL, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  await migrate("006_sound_muted", async () => { await exec(`ALTER TABLE locations ADD COLUMN sound_muted INTEGER NOT NULL DEFAULT 0`); });
  await migrate("007_biweekly_start", async () => { await exec(`ALTER TABLE tasks ADD COLUMN biweekly_start TEXT`); });
  await migrate("008_file_content", async () => { await exec(`ALTER TABLE forms ADD COLUMN file_content BLOB`); });
  await migrate("009_allow_early_complete", async () => { await exec(`ALTER TABLE tasks ADD COLUMN allow_early_complete INTEGER NOT NULL DEFAULT 0`); });
  await migrate("010_current_page", async () => { await exec(`ALTER TABLE sessions ADD COLUMN current_page TEXT`); });
  await migrate("011_show_in_today", async () => { await exec(`ALTER TABLE tasks ADD COLUMN show_in_today INTEGER NOT NULL DEFAULT 1`); });
  await migrate("012_show_in_7day", async () => { await exec(`ALTER TABLE tasks ADD COLUMN show_in_7day INTEGER NOT NULL DEFAULT 1`); });
  await migrate("013_show_in_calendar", async () => { await exec(`ALTER TABLE tasks ADD COLUMN show_in_calendar INTEGER NOT NULL DEFAULT 1`); });
  await migrate("014_bonus_points", async () => { await exec(`ALTER TABLE task_completions ADD COLUMN bonus_points INTEGER NOT NULL DEFAULT 0`); });
  await migrate("015_deleted_by", async () => { await exec(`ALTER TABLE conversations ADD COLUMN deleted_by TEXT NOT NULL DEFAULT '[]'`); });
  await migrate("016_conv_created_by_type", async () => { await exec(`ALTER TABLE conversations ADD COLUMN created_by_type TEXT`); });

  await migrate("017_message_reactions", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS message_reactions (
      id TEXT PRIMARY KEY, message_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_type TEXT NOT NULL, user_name TEXT NOT NULL, emoji TEXT NOT NULL, created_at TEXT NOT NULL
    )`);
  });

  await migrate("018_reaction_cols", async () => {
    await exec(`ALTER TABLE message_reactions ADD COLUMN user_type TEXT NOT NULL DEFAULT 'location'`);
    await exec(`ALTER TABLE message_reactions ADD COLUMN user_name TEXT NOT NULL DEFAULT 'Unknown'`);
  });

  await migrate("019_pending_sessions", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS pending_sessions (
      id TEXT PRIMARY KEY, code TEXT NOT NULL UNIQUE, status TEXT NOT NULL DEFAULT 'pending',
      assigned_user_type TEXT, assigned_user_id TEXT, activated_by TEXT, token TEXT,
      redirect_to TEXT, user_agent TEXT, created_at TEXT NOT NULL, activated_at TEXT, expires_at TEXT NOT NULL
    )`);
  });

  await migrate("020_scheduled_meetings", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS scheduled_meetings (
      id TEXT PRIMARY KEY, meeting_code TEXT NOT NULL UNIQUE, title TEXT NOT NULL,
      description TEXT, password TEXT, host_id TEXT NOT NULL, host_name TEXT NOT NULL,
      scheduled_at TEXT NOT NULL, duration_minutes INTEGER NOT NULL DEFAULT 60,
      is_recurring INTEGER NOT NULL DEFAULT 0, recurring_type TEXT, recurring_days TEXT,
      allow_guests INTEGER NOT NULL DEFAULT 0, is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  await migrate("021_meeting_participants", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS meeting_participants (
      id TEXT PRIMARY KEY NOT NULL, meeting_id TEXT NOT NULL, participant_id TEXT NOT NULL,
      participant_name TEXT NOT NULL, participant_type TEXT NOT NULL, role TEXT NOT NULL,
      joined_at TEXT NOT NULL, left_at TEXT, duration INTEGER,
      had_video INTEGER NOT NULL DEFAULT 0, had_audio INTEGER NOT NULL DEFAULT 1,
      messages_sent INTEGER NOT NULL DEFAULT 0, questions_sent INTEGER NOT NULL DEFAULT 0,
      reactions_sent INTEGER NOT NULL DEFAULT 0, hand_raise_count INTEGER NOT NULL DEFAULT 0,
      was_muted_by_host INTEGER NOT NULL DEFAULT 0, connection_quality TEXT, device_type TEXT
    )`);
  });

  await migrate("022_group_chat", async () => {
    await exec(`ALTER TABLE conversation_members ADD COLUMN role TEXT NOT NULL DEFAULT 'member'`);
    await exec(`ALTER TABLE conversation_members ADD COLUMN left_at TEXT`);
    await exec(`ALTER TABLE conversations ADD COLUMN description TEXT`);
    await exec(`ALTER TABLE conversations ADD COLUMN avatar_color TEXT`);
  });

  await migrate("023_conversation_settings", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS conversation_settings (
      id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL, user_id TEXT NOT NULL,
      user_type TEXT NOT NULL, is_muted INTEGER NOT NULL DEFAULT 0,
      muted_until TEXT, created_at TEXT NOT NULL, updated_at TEXT NOT NULL
    )`);
  });

  await migrate("024_assign_roles", async () => {
    try {
      const membersWithoutRoles = await all(
        `SELECT id, member_type FROM conversation_members WHERE role IS NULL`
      ) as unknown as Array<{ id: string; member_type: string }>;
      for (const member of membersWithoutRoles) {
        const role = member.member_type === "arl" ? "admin" : "member";
        await run(`UPDATE conversation_members SET role = ? WHERE id = ?`, role, member.id);
      }
    } catch {}
  });

  await migrate("025_message_metadata", async () => { await exec(`ALTER TABLE messages ADD COLUMN metadata TEXT`); });

  await migrate("026_ticker_messages", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS ticker_messages (
      id TEXT PRIMARY KEY, content TEXT NOT NULL, icon TEXT NOT NULL DEFAULT '📢',
      arl_id TEXT NOT NULL, arl_name TEXT NOT NULL, expires_at TEXT, created_at TEXT NOT NULL
    )`);
  });

  // Ensure notifications table has all required columns
  // (table may have been created by an older schema missing user_id and other columns)
  await migrate("026b_notifications_table", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY, user_id TEXT NOT NULL DEFAULT '', user_type TEXT NOT NULL DEFAULT 'location',
      type TEXT NOT NULL DEFAULT 'system', title TEXT NOT NULL DEFAULT '', message TEXT NOT NULL DEFAULT '',
      action_url TEXT, action_label TEXT, priority TEXT NOT NULL DEFAULT 'normal',
      metadata TEXT, is_read INTEGER NOT NULL DEFAULT 0, read_at TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    )`);
    try { await exec(`ALTER TABLE notifications ADD COLUMN user_id TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN user_type TEXT NOT NULL DEFAULT 'location'`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN type TEXT NOT NULL DEFAULT 'system'`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN title TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN message TEXT NOT NULL DEFAULT ''`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN action_url TEXT`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN action_label TEXT`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN priority TEXT NOT NULL DEFAULT 'normal'`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN metadata TEXT`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN is_read INTEGER NOT NULL DEFAULT 0`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN read_at TEXT`); } catch {}
    try { await exec(`ALTER TABLE notifications ADD COLUMN created_at TEXT`); } catch {}
  });

  // Unique constraints to prevent duplicate records
  await migrate("027_unique_task_completion", async () => {
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_task_completion_unique ON task_completions(task_id, location_id, completed_date)`);
  });
  await migrate("028_unique_message_read", async () => {
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_message_read_unique ON message_reads(message_id, reader_id)`);
  });
  await migrate("029_unique_conversation_member", async () => {
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_conversation_member_unique ON conversation_members(conversation_id, member_id)`);
  });
  await migrate("030_unique_message_reaction", async () => {
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_message_reaction_unique ON message_reactions(message_id, user_id, emoji)`);
  });

  // Performance indexes (previously in add-indexes.ts script, now auto-applied)
  await migrate("031_perf_indexes", async () => {
    await exec(`CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id, created_at)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_task_completions_lookup ON task_completions(task_id, location_id, completed_date)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_message_reads_message ON message_reads(message_id)`);
  });

  // Retry notifications index in case 031 silently failed due to missing user_id column
  await migrate("032_notifications_index_retry", async () => {
    await exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
  });

  // ── Multi-tenant migrations ──

  await migrate("033_tenants_table", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS tenants (
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

  await migrate("034_seed_kazi_tenant", async () => {
    const now = new Date().toISOString();
    await run(`INSERT OR IGNORE INTO tenants (id, slug, name, app_title, plan, features, max_locations, max_users, is_active, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      "kazi", "kazi", "Kazi Franchise", "The Hub", "enterprise",
      '["messaging","tasks","forms","gamification","meetings","analytics","broadcasts"]',
      100, 50, 1, now, now);
  });

  // Add tenant_id columns to all existing tables and backfill with 'kazi'
  const tenantTables = [
    "locations", "arls", "tasks", "conversations", "forms",
    "daily_leaderboard", "emergency_messages", "notifications",
    "broadcasts", "meeting_analytics", "ticker_messages",
  ];
  await migrate("035_add_tenant_id_columns", async () => {
    for (const table of tenantTables) {
      try { await exec(`ALTER TABLE ${table} ADD COLUMN tenant_id TEXT NOT NULL DEFAULT 'kazi'`); } catch {}
    }
  });

  await migrate("036_backfill_tenant_id", async () => {
    for (const table of tenantTables) {
      try { await exec(`UPDATE ${table} SET tenant_id = 'kazi' WHERE tenant_id IS NULL OR tenant_id = ''`); } catch {}
    }
  });

  await migrate("037_tenant_id_indexes", async () => {
    for (const table of tenantTables) {
      try { await exec(`CREATE INDEX IF NOT EXISTS idx_${table}_tenant ON ${table}(tenant_id)`); } catch {}
    }
  });

  // Remove unique constraint on locations.store_number (now unique per tenant, not globally)
  // SQLite doesn't support DROP INDEX on unique constraints easily, so we use a composite index instead
  await migrate("038_tenant_composite_indexes", async () => {
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_tenant_store ON locations(tenant_id, store_number)`);
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_locations_tenant_userid ON locations(tenant_id, user_id)`);
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_arls_tenant_userid ON arls(tenant_id, user_id)`);
  });

  // ── ARL Permissions system ──
  await migrate("039_arl_permissions", async () => {
    try { await exec(`ALTER TABLE arls ADD COLUMN permissions TEXT`); } catch {}
    // Promote userId "2092" under Kazi tenant to admin
    await run(`UPDATE arls SET role = 'admin' WHERE user_id = '2092' AND tenant_id = 'kazi'`);
  });

  // ── Foreign key & query performance indexes ──
  await migrate("040_fk_indexes", async () => {
    // task_completions lookups by location
    await exec(`CREATE INDEX IF NOT EXISTS idx_task_completions_location ON task_completions(location_id)`);
    // message_reads by reader (for unread count queries)
    await exec(`CREATE INDEX IF NOT EXISTS idx_message_reads_reader ON message_reads(reader_id, reader_type)`);
    // conversation_members by member (for "my conversations" queries)
    await exec(`CREATE INDEX IF NOT EXISTS idx_conv_members_member ON conversation_members(member_id, member_type)`);
    // messages by sender (for search / activity queries)
    await exec(`CREATE INDEX IF NOT EXISTS idx_messages_sender ON messages(sender_id)`);
    // push_subscriptions by user
    await exec(`CREATE INDEX IF NOT EXISTS idx_push_subs_user ON push_subscriptions(user_id)`);
    // sessions expiry (for cleanup queries)
    await exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expires ON sessions(expires_at)`);
    // pending_sessions expiry
    await exec(`CREATE INDEX IF NOT EXISTS idx_pending_sessions_expires ON pending_sessions(expires_at)`);
    // emergency_messages tenant + active
    await exec(`CREATE INDEX IF NOT EXISTS idx_emergency_tenant_active ON emergency_messages(tenant_id, is_active)`);
    // broadcasts by tenant + arl
    await exec(`CREATE INDEX IF NOT EXISTS idx_broadcasts_tenant ON broadcasts(tenant_id)`);
    // ticker messages expiry
    await exec(`CREATE INDEX IF NOT EXISTS idx_ticker_expires ON ticker_messages(expires_at)`);
  });

  // ── RBAC: Roles table + ARL location-scoping ──
  await migrate("041_roles_table", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS roles (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      name TEXT NOT NULL,
      description TEXT,
      permissions TEXT NOT NULL,
      is_default INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id)`);
  });

  await migrate("042_arl_role_id_and_locations", async () => {
    try { await exec(`ALTER TABLE arls ADD COLUMN role_id TEXT`); } catch {}
    try { await exec(`ALTER TABLE arls ADD COLUMN assigned_location_ids TEXT`); } catch {}
  });

  await migrate("043_seed_default_roles", async () => {
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
      await run(`INSERT OR IGNORE INTO roles (id, tenant_id, name, description, permissions, is_default, created_at, updated_at)
        VALUES (?, 'kazi', ?, ?, ?, 1, ?, ?)`, role.id, role.name, role.description, role.permissions, now, now);
    }
  });

  // ── Location Groups / Regions ──
  await migrate("044_location_groups", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS location_groups (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL DEFAULT 'kazi',
      name TEXT NOT NULL,
      description TEXT,
      color TEXT,
      parent_id TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    )`);
    await exec(`CREATE TABLE IF NOT EXISTS location_group_members (
      id TEXT PRIMARY KEY,
      group_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      created_at TEXT NOT NULL
    )`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_location_groups_tenant ON location_groups(tenant_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_lgm_group ON location_group_members(group_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_lgm_location ON location_group_members(location_id)`);
    await exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_lgm_unique ON location_group_members(group_id, location_id)`);
  });

  // ── Scheduled Reports ──
  await migrate("045_scheduled_reports", async () => {
    await exec(`CREATE TABLE IF NOT EXISTS scheduled_reports (
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
    await exec(`CREATE TABLE IF NOT EXISTS report_history (
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
    await exec(`CREATE INDEX IF NOT EXISTS idx_scheduled_reports_tenant ON scheduled_reports(tenant_id)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_report_history_report ON report_history(report_id)`);
  });

  // ── Fix notifications table: old schema had location_id NOT NULL which breaks createNotification ──
  await migrate("046_rebuild_notifications_table", async () => {
    // Check if the old location_id column exists
    const cols = await all(`PRAGMA table_info(notifications)`) as unknown as Array<{ name: string }>;
    const hasLocationId = cols.some((c) => c.name === "location_id");
    if (!hasLocationId) return; // Already on new schema

    // Rebuild: copy data, drop old table, create new, copy back
    await exec(`ALTER TABLE notifications RENAME TO _notifications_old`);
    await exec(`CREATE TABLE notifications (
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
    await exec(`INSERT INTO notifications (id, tenant_id, user_id, user_type, type, title, message, is_read, created_at)
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
    await exec(`DROP TABLE _notifications_old`);
    // Re-create indexes
    await exec(`CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id, is_read, created_at)`);
    await exec(`CREATE INDEX IF NOT EXISTS idx_notifications_tenant ON notifications(tenant_id)`);
  });

  const countResult = await get(`SELECT COUNT(*) as c FROM _migrations`);
  console.log(`✅ Migrations complete (${(countResult as any)?.c ?? 0} applied)`);
}

// Proxy objects so all existing `db.xxx` calls work with lazy init
export const db = new Proxy({} as ReturnType<typeof drizzle<typeof schema>>, {
  get(_target, prop, receiver) {
    return Reflect.get(getDb(), prop, receiver);
  },
});

export { schema };
