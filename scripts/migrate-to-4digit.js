// Migration script to truncate User IDs and PINs from 6 digits to 4 digits
// This script takes the last 4 digits of existing User IDs and PINs

const Database = require('better-sqlite3');
const path = require('path');

// Path to your database
const dbPath = path.join(__dirname, '..', 'data', 'database.sqlite');

try {
  console.log('🔄 Starting migration: Truncate User IDs and PINs to 4 digits...');
  
  const db = new Database(dbPath);
  
  // Start transaction
  const transaction = db.transaction(() => {
    // Update ARL users (truncate userId)
    console.log('📝 Updating ARL users...');
    const arlUsers = db.prepare('SELECT id, userId FROM arls WHERE LENGTH(userId) > 4').all();
    console.log(`Found ${arlUsers.length} ARL users with User IDs longer than 4 digits`);
    
    for (const user of arlUsers) {
      const newUserId = user.userId.slice(-4); // Take last 4 digits
      db.prepare('UPDATE arls SET userId = ? WHERE id = ?').run(newUserId, user.id);
      console.log(`  Updated ARL ${user.id}: ${user.userId} → ${newUserId}`);
    }
    
    // Update locations (truncate userId)
    console.log('📍 Updating locations...');
    const locations = db.prepare('SELECT id, userId FROM locations WHERE LENGTH(userId) > 4').all();
    console.log(`Found ${locations.length} locations with User IDs longer than 4 digits`);
    
    for (const location of locations) {
      const newUserId = location.userId.slice(-4); // Take last 4 digits
      db.prepare('UPDATE locations SET userId = ? WHERE id = ?').run(newUserId, location.id);
      console.log(`  Updated Location ${location.id}: ${location.userId} → ${newUserId}`);
    }
    
    // Note: PINs are not stored in the database, they're validated against the userId
    // So we only need to update the userId fields
    
    console.log('✅ Migration completed successfully!');
  });
  
  transaction();
  
  // Verify the changes
  console.log('\n🔍 Verification:');
  const arlCount = db.prepare('SELECT COUNT(*) as count FROM arls WHERE LENGTH(userId) = 4').get();
  const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations WHERE LENGTH(userId) = 4').get();
  
  console.log(`ARL users with 4-digit IDs: ${arlCount.count}`);
  console.log(`Locations with 4-digit IDs: ${locationCount.count}`);
  
  db.close();
  
} catch (error) {
  console.error('❌ Migration failed:', error);
  process.exit(1);
}

console.log('\n🎉 Migration complete! The login system now uses 4-digit User IDs and PINs.');
