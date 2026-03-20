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

  // Create migration tracking table if it doesn't exist.
  // If it exists with a different schema, drop and recreate it —
  // it's just a tracking table, not user data.
  try {
    db.prepare('SELECT name FROM _migrations LIMIT 1').get();
  } catch {
    // Table doesn't exist or has wrong schema — (re)create it
    db.exec('DROP TABLE IF EXISTS _migrations');
    db.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  }

  // Backfill: if the tracking table is brand new but the DB already has tables
  // from previous migrations, mark those old migrations as already applied.
  const trackingCount = db.prepare('SELECT COUNT(*) as c FROM _migrations').get().c;
  if (trackingCount === 0) {
    // Check if the DB has tables from the original schema (migration 0000)
    const hasLocations = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='locations'"
    ).get();
    if (hasLocations) {
      // DB was set up before tracking existed — mark old migrations as applied
      const oldMigrations = [
        '0000_left_energizer.sql',
        '0001_glossy_fallen_one.sql',
        '0002_puzzling_doctor_doom.sql',
      ];
      const insert = db.prepare('INSERT OR IGNORE INTO _migrations (name) VALUES (?)');
      for (const m of oldMigrations) {
        insert.run(m);
      }
      console.log('  ℹ️  Backfilled 3 pre-existing migrations into tracking table');
    }
  }

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

    // Split by statement-breakpoint (Drizzle convention) and execute each
    const statements = sql.split('--> statement-breakpoint');

    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('-->')) {
        try {
          db.exec(trimmed);
        } catch (err) {
          // Ignore idempotency errors (column/table already exists or was already dropped)
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
}
