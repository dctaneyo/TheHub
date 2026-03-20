import { sqlite } from './db';

/**
 * Ensures critical database indexes exist. Safe to call on every startup
 * since all statements use CREATE INDEX IF NOT EXISTS.
 */
export function ensureIndexes() {
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
