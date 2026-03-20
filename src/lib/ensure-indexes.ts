import { sqlite } from './db';

/**
 * Ensures critical database indexes and schema patches exist.
 * Safe to call on every startup — all statements are idempotent.
 */
export function ensureIndexes() {
  // Schema patches — add columns that may be missing if migrations haven't run yet.
  // ALTER TABLE ADD COLUMN throws "duplicate column" if it exists, which we catch.
  const patches = [
    `ALTER TABLE tenants ADD COLUMN timezone TEXT NOT NULL DEFAULT 'Pacific/Honolulu'`,
    `ALTER TABLE locations ADD COLUMN timezone TEXT`,
  ];

  for (const sql of patches) {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
  }

  // Ensure audit_log table has correct schema (may have been created by older code)
  try {
    sqlite.prepare('SELECT operation FROM audit_log LIMIT 0').get();
  } catch {
    // Table missing or wrong schema — recreate
    try { sqlite.exec('DROP TABLE IF EXISTS audit_log_old'); } catch { /* */ }
    try { sqlite.exec('ALTER TABLE audit_log RENAME TO audit_log_old'); } catch { /* */ }
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        operation TEXT NOT NULL DEFAULT 'unknown',
        entity_type TEXT NOT NULL DEFAULT 'unknown',
        affected_count INTEGER NOT NULL DEFAULT 1,
        payload TEXT,
        status TEXT NOT NULL DEFAULT 'success',
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);
    try {
      sqlite.exec(`
        INSERT INTO audit_log (id, user_id, user_type, operation, entity_type, created_at)
        SELECT id, user_id, user_type, COALESCE(action, 'unknown'), 'unknown', created_at
        FROM audit_log_old
      `);
      sqlite.exec('DROP TABLE audit_log_old');
    } catch { /* no old data */ }
  }

  const indexes = [
    // Tenant isolation
    `CREATE INDEX IF NOT EXISTS idx_arls_tenant ON arls(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_locations_tenant ON locations(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_tasks_tenant ON tasks(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_conversations_tenant ON conversations(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_roles_tenant ON roles(tenant_id)`,
    // Sessions (hot path: presence checks, stale cleanup)
    `CREATE INDEX IF NOT EXISTS idx_sessions_user_online ON sessions(user_id, user_type, is_online)`,
    `CREATE INDEX IF NOT EXISTS idx_sessions_last_seen ON sessions(last_seen)`,
    // Messages (hot path: chat loading)
    `CREATE INDEX IF NOT EXISTS idx_messages_conversation_time ON messages(conversation_id, created_at DESC)`,
    // Task completions (hot path: leaderboard)
    `CREATE INDEX IF NOT EXISTS idx_completions_location_date ON task_completions(location_id, completed_date)`,
    // Notifications
    `CREATE INDEX IF NOT EXISTS idx_notifications_user ON notifications(user_id)`,
    // Audit log
    `CREATE INDEX IF NOT EXISTS idx_audit_log_tenant ON audit_log(tenant_id)`,
    `CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at DESC)`,
  ];

  for (const sql of indexes) {
    try { sqlite.exec(sql); } catch { /* table may not exist yet */ }
  }
}
