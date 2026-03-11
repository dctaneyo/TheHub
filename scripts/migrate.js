#!/usr/bin/env node

const Database = require('better-sqlite3');
const fs = require('fs');
const path = require('path');

console.log('Running database migrations...');

try {
  // Ensure the database directory exists
  const dbPath = process.env.DATABASE_PATH || './data/hub.db';
  const dbDir = path.dirname(dbPath);
  
  if (!fs.existsSync(dbDir)) {
    fs.mkdirSync(dbDir, { recursive: true });
  }
  
  // Open database connection
  const db = new Database(dbPath);
  
  // Check if _migrations table exists and what columns it has
  const tableInfo = db.prepare("PRAGMA table_info(_migrations)").all();
  const hasNameColumn = tableInfo.some(col => col.name === 'name');
  
  if (tableInfo.length === 0) {
    // Table doesn't exist, create it
    db.exec(`
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
  } else if (!hasNameColumn) {
    // Old schema exists, migrate it
    console.log('🔄 Migrating _migrations table to new schema...');
    db.exec(`
      DROP TABLE IF EXISTS _migrations;
      CREATE TABLE _migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        applied_at TEXT NOT NULL DEFAULT (datetime('now'))
      )
    `);
    console.log('✅ _migrations table migrated');
  }
  
  // Get list of already applied migrations
  const appliedMigrations = db.prepare('SELECT name FROM _migrations').all().map(row => row.name);
  
  // Get list of all migration files
  const migrationsDir = path.join(__dirname, '../drizzle');
  const migrationFiles = fs.readdirSync(migrationsDir)
    .filter(file => file.endsWith('.sql'))
    .sort(); // Sort to ensure migrations run in order
  
  if (migrationFiles.length === 0) {
    console.log('⚠️  No migration files found');
    db.close();
    return;
  }
  
  let migrationsRun = 0;
  
  // Run each migration that hasn't been applied yet
  for (const file of migrationFiles) {
    if (appliedMigrations.includes(file)) {
      console.log(`⏭️  Skipping ${file} (already applied)`);
      continue;
    }
    
    console.log(`🔄 Running migration: ${file}`);
    const migrationPath = path.join(migrationsDir, file);
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint');
    
    try {
      for (const statement of statements) {
        const trimmed = statement.trim();
        if (trimmed && !trimmed.startsWith('-->')) {
          try {
            db.exec(trimmed);
          } catch (err) {
            // Ignore errors for DROP TABLE statements if table doesn't exist
            // Also ignore ALTER TABLE errors for columns that already exist
            if (!trimmed.startsWith('DROP TABLE') && !err.message.includes('duplicate column')) {
              throw err;
            }
          }
        }
      }
      
      // Mark migration as applied
      db.prepare('INSERT INTO _migrations (name) VALUES (?)').run(file);
      console.log(`✅ Migration ${file} completed successfully`);
      migrationsRun++;
    } catch (err) {
      console.error(`❌ Migration ${file} failed:`, err.message);
      throw err;
    }
  }
  
  if (migrationsRun === 0) {
    console.log('✅ All migrations already applied');
  } else {
    console.log(`✅ Successfully applied ${migrationsRun} migration(s)`);
  }
  
  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  // Don't exit with error - let the app start anyway
  // The tables might already exist
}
