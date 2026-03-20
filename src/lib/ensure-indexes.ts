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
    // audit_log columns that may be missing from older table versions
    `ALTER TABLE audit_log ADD COLUMN tenant_id TEXT`,
    `ALTER TABLE audit_log ADD COLUMN operation TEXT NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE audit_log ADD COLUMN entity_type TEXT NOT NULL DEFAULT 'unknown'`,
    `ALTER TABLE audit_log ADD COLUMN affected_count INTEGER NOT NULL DEFAULT 1`,
    `ALTER TABLE audit_log ADD COLUMN payload TEXT`,
    `ALTER TABLE audit_log ADD COLUMN status TEXT NOT NULL DEFAULT 'success'`,
    `ALTER TABLE audit_log ADD COLUMN error_message TEXT`,
  ];

  for (const sql of patches) {
    try { sqlite.exec(sql); } catch { /* column already exists */ }
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
