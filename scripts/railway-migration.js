// Simple migration script for Railway console
// Run this in Railway's console: node scripts/railway-migration.js

const Database = require('better-sqlite3');
const path = require('path');

console.log('🔄 Starting 4-digit migration...');

try {
  const dbPath = path.join(process.cwd(), 'data', 'database.sqlite');
  console.log('Database path:', dbPath);
  
  const db = new Database(dbPath);
  
  // Update ARL users
  console.log('📝 Updating ARL users...');
  const arlUsers = db.prepare('SELECT id, userId FROM arls WHERE LENGTH(userId) > 4').all();
  console.log(`Found ${arlUsers.length} ARL users with User IDs longer than 4 digits`);
  
  for (const user of arlUsers) {
    const newUserId = user.userId.slice(-4);
    db.prepare('UPDATE arls SET userId = ? WHERE id = ?').run(newUserId, user.id);
    console.log(`  Updated ARL ${user.id}: ${user.userId} → ${newUserId}`);
  }
  
  // Update locations
  console.log('📍 Updating locations...');
  const locations = db.prepare('SELECT id, userId FROM locations WHERE LENGTH(userId) > 4').all();
  console.log(`Found ${locations.length} locations with User IDs longer than 4 digits`);
  
  for (const location of locations) {
    const newUserId = location.userId.slice(-4);
    db.prepare('UPDATE locations SET userId = ? WHERE id = ?').run(newUserId, location.id);
    console.log(`  Updated Location ${location.id}: ${location.userId} → ${newUserId}`);
  }
  
  // Verify
  const arlCount = db.prepare('SELECT COUNT(*) as count FROM arls WHERE LENGTH(userId) = 4').get();
  const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations WHERE LENGTH(userId) = 4').get();
  
  console.log('\n✅ Migration completed successfully!');
  console.log(`ARL users with 4-digit IDs: ${arlCount.count}`);
  console.log(`Locations with 4-digit IDs: ${locationCount.count}`);
  
  db.close();
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n🎉 Migration complete!');
