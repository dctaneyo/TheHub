import { sqlite } from './db';
import { v4 as uuid } from 'uuid';

// Ensure audit log table exists (includes tenant_id for multi-tenant isolation)
function ensureAuditTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
        tenant_id TEXT,
        user_id TEXT NOT NULL,
        user_type TEXT NOT NULL,
        operation TEXT NOT NULL,
        entity_type TEXT NOT NULL,
        affected_count INTEGER NOT NULL,
        payload TEXT,
        status TEXT NOT NULL,
        error_message TEXT,
        created_at TEXT NOT NULL
      )
    `);
    // Add columns that may be missing from older versions of the table
    const patches = [
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
