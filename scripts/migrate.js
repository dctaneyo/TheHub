#!/usr/bin/env node

const { execSync } = require('child_process');
const path = require('path');

console.log('Running database migrations...');

try {
  // Ensure the database directory exists
  const dbPath = process.env.DATABASE_PATH || './data/hub.db';
  const dbDir = path.dirname(dbPath);
  
  execSync(`mkdir -p ${dbDir}`, { stdio: 'inherit' });
  
  // Run the migration
  execSync('npx drizzle-kit push --force', { 
    stdio: 'inherit',
    env: { ...process.env }
  });
  
  console.log('✅ Database migrations completed successfully');
} catch (error) {
  console.error('❌ Migration failed:', error.message);
  // Don't exit with error - let the app start anyway
  // The tables might already exist
}
