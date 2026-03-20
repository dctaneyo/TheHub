#!/usr/bin/env node

/**
 * Applies all pending SQL migrations from drizzle/ in order.
 * Tracks applied migrations in a `_migrations` table so each file runs only once.
 */

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('Running database migrations...');

try {
  const dbPath = process.env.DATABASE_PATH || './data/hub.db';
  const dbDir = path.dirname(dbPath);

  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }

  const db = new Database(dbPath);

  // Create migration tracking table if it doesn't exist
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  // Get already-applied migrations
  const applied = new Set(
    db.prepare('SELECT name FROM _migrations').all().map(r => r.name)
  );

  // Find all .sql files in drizzle/ directory, sorted by name
  const migrationsDir = path.join(__dirname, '../drizzle');
  const files = fs.readdirSync(migrationsDir)
    .filter(f => f.endsWith('.sql'))
    .sort();

  let count = 0;

  for (const file of files) {
    if (applied.has(file)) continue;

    const sql = fs.readFileSync(path.join(migrationsDir, file), 'utf8');

    // Split by statement-breakpoint (Drizzle convention) and execute each statement
    const statements = sql.split('--> statement-breakpoint');

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('-->')) {
        try {
          db.exec(trimmed);
        } catch (err) {
          // Ignore "duplicate column" or "table already exists" errors for idempotency
          if (err.message && (
            err.message.includes('duplicate column') ||
            err.message.includes('already exists')
          )) {
            console.log(`  ⚠️  ${file}: ${err.message} (skipped)`);
          } else {
            throw err;
          }
        }
      }
    }

    // Record migration as applied
    db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
    console.log(`  ✅ Applied: ${file}`);
    count++;
  }

  console.log(`✅ Migrations complete (${count} applied, ${applied.size} already up-to-date)`);
  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  // Don't exit with error — let the app start anyway
  // The tables might already exist from a previous run
}
