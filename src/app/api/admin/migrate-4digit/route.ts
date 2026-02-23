import { NextResponse } from "next/server";

// One-time migration endpoint - DELETE AFTER USE
export async function POST() {
  try {
    console.log('🔄 Starting migration: Truncate User IDs and PINs to 4 digits...');
    
    // Import database dynamically for this endpoint
    const { sqlite } = await import("@/lib/db");
    
    // Update ARL users (truncate userId)
    console.log('📝 Updating ARL users...');
    const arlUsers = sqlite.prepare('SELECT id, userId FROM arls WHERE LENGTH(userId) > 4').all();
    console.log(`Found ${arlUsers.length} ARL users with User IDs longer than 4 digits`);
    
    for (const user of arlUsers as any[]) {
      const newUserId = user.userId.slice(-4); // Take last 4 digits
      sqlite.prepare('UPDATE arls SET userId = ? WHERE id = ?').run(newUserId, user.id);
      console.log(`  Updated ARL ${user.id}: ${user.userId} → ${newUserId}`);
    }
    
    // Update locations (truncate userId)
    console.log('📍 Updating locations...');
    const locations = sqlite.prepare('SELECT id, userId FROM locations WHERE LENGTH(userId) > 4').all();
    console.log(`Found ${locations.length} locations with User IDs longer than 4 digits`);
    
    for (const location of locations as any[]) {
      const newUserId = location.userId.slice(-4); // Take last 4 digits
      sqlite.prepare('UPDATE locations SET userId = ? WHERE id = ?').run(newUserId, location.id);
      console.log(`  Updated Location ${location.id}: ${location.userId} → ${newUserId}`);
    }
    
    // Verify the changes
    console.log('\n🔍 Verification:');
    const arlCount = sqlite.prepare('SELECT COUNT(*) as count FROM arls WHERE LENGTH(userId) = 4').get() as any;
    const locationCount = sqlite.prepare('SELECT COUNT(*) as count FROM locations WHERE LENGTH(userId) = 4').get() as any;
    
    const result = {
      success: true,
      message: 'Migration completed successfully!',
      stats: {
        arlUsersUpdated: arlUsers.length,
        locationsUpdated: locations.length,
        totalArlUsersWith4Digits: arlCount.count,
        totalLocationsWith4Digits: locationCount.count
      }
    };
    
    console.log('✅ Migration completed successfully!');
    console.log(`ARL users with 4-digit IDs: ${arlCount.count}`);
    console.log(`Locations with 4-digit IDs: ${locationCount.count}`);
    
    return NextResponse.json(result);
    
  } catch (error: any) {
    console.error('❌ Migration failed:', error);
    return NextResponse.json({ 
      success: false, 
      error: error.message 
    }, { status: 500 });
  }
}
