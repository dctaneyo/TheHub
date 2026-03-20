import { sqlite } from './db';
import { v4 as uuid } from 'uuid';

// Track whether we've already verified the table this process
let _tableVerified = false;

// Ensure audit log table has the correct schema.
// If the table was created by older code with a different schema, drop and recreate it.
function ensureAuditTable() {
  if (_tableVerified) return;

  try {
    // Check if the table has the columns we need
    const hasOperation = (() => {
      try {
        sqlite.prepare('SELECT operation FROM audit_log LIMIT 0').get();
        return true;
      } catch {
        return false;
      }
    })();

    if (!hasOperation) {
      // Table either doesn't exist or has wrong schema — recreate it
      // Preserve any existing data by renaming first
      try { sqlite.exec('DROP TABLE IF EXISTS audit_log_old'); } catch { /* */ }
      try { sqlite.exec('ALTER TABLE audit_log RENAME TO audit_log_old'); } catch { /* table doesn't exist */ }

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

      // Migrate old data if it existed
      try {
        sqlite.exec(`
          INSERT INTO audit_log (id, user_id, user_type, operation, entity_type, created_at)
          SELECT id, user_id, user_type, COALESCE(action, 'unknown'), 'unknown', created_at
          FROM audit_log_old
        `);
        sqlite.exec('DROP TABLE audit_log_old');
      } catch { /* no old data or incompatible schema — that's fine */ }
    }

    _tableVerified = true;
  } catch (e) {
    console.error("Failed to ensure audit_log table:", e);
  }
}

export function logAudit(params: {
  tenantId?: string;
  userId: string;
  userType: string;
  operation: string;
  entityType: string;
  affectedCount?: number;
  payload?: any;
  status: 'success' | 'failed';
  errorMessage?: string;
}) {
  try {
    ensureAuditTable();

    sqlite.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, user_type, operation, entity_type, affected_count, payload, status, error_message, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      uuid(),
      params.tenantId || null,
      params.userId,
      params.userType,
      params.operation,
      params.entityType,
      params.affectedCount ?? 1,
      params.payload ? JSON.stringify(params.payload) : null,
      params.status,
      params.errorMessage || null,
      new Date().toISOString()
    );
  } catch (e) {
    // Audit logging should never break the actual operation
    console.error("logAudit failed (non-fatal):", e);
  }
}

/** @deprecated Use logAudit instead */
export const logBulkOperation = logAudit;

export function getAuditLog(limit: number = 50, tenantId?: string) {
  ensureAuditTable();

  if (tenantId) {
    return sqlite.prepare(`
      SELECT * FROM audit_log WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?
    `).all(tenantId, limit);
  }
  return sqlite.prepare(`
    SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}
