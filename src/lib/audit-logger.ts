import { sqlite } from './db';
import { v4 as uuid } from 'uuid';

// Ensure audit log table exists
function ensureAuditTable() {
  try {
    sqlite.exec(`
      CREATE TABLE IF NOT EXISTS audit_log (
        id TEXT PRIMARY KEY,
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
  } catch {}
}

export function logBulkOperation(params: {
  userId: string;
  userType: string;
  operation: string;
  entityType: string;
  affectedCount: number;
  payload?: any;
  status: 'success' | 'failed';
  errorMessage?: string;
}) {
  ensureAuditTable();

  sqlite.prepare(`
    INSERT INTO audit_log (id, user_id, user_type, operation, entity_type, affected_count, payload, status, error_message, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    uuid(),
    params.userId,
    params.userType,
    params.operation,
    params.entityType,
    params.affectedCount,
    params.payload ? JSON.stringify(params.payload) : null,
    params.status,
    params.errorMessage || null,
    new Date().toISOString()
  );
}

export function getAuditLog(limit: number = 50) {
  ensureAuditTable();

  return sqlite.prepare(`
    SELECT * FROM audit_log ORDER BY created_at DESC LIMIT ?
  `).all(limit);
}
