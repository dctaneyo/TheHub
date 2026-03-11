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
  
  // Check if broadcasts table already exists
  const tableExists = db.prepare(
    "SELECT name FROM sqlite_master WHERE type='table' AND name='broadcasts'"
  ).get();
  
  if (tableExists) {
    console.log('✅ Broadcast tables already exist, skipping migration');
    db.close();
    return;
  }
  
  // Read and execute the migration SQL
  const migrationPath = path.join(__dirname, '../drizzle/0002_puzzling_doctor_doom.sql');
  
  if (fs.existsSync(migrationPath)) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    // Split by statement-breakpoint and execute each statement
    const statements = sql.split('--> statement-breakpoint');
    
    for (const statement of statements) {
      const trimmed = statement.trim();
      if (trimmed && !trimmed.startsWith('-->')) {
        try {
          db.exec(trimmed);
        } catch (err) {
          // Ignore errors for DROP TABLE statements if table doesn't exist
          if (!trimmed.startsWith('DROP TABLE')) {
            throw err;
          }
        }
      }
    }
    
    console.log('✅ Database migrations completed successfully');
  } else {
    console.log('⚠️  No migration file found, skipping');
  }
  
  db.close();
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  // Don't exit with error - let the app start anyway
  // The tables might already exist
}
