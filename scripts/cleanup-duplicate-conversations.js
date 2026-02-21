// Database cleanup script to remove duplicate conversations
// This script should be run on the Railway deployment

const { drizzle } = require('drizzle-orm/postgres-js');
const { eq } = require('drizzle-orm');

// Import your schema (adjust path as needed)
const schema = require('../src/lib/db/schema.js');

async function cleanupDuplicateConversations() {
  console.log('🧹 Starting duplicate conversation cleanup...');
  
  try {
    // Get all conversations
    const allConversations = await db.select().from(schema.conversations).all();
    console.log(`Found ${allConversations.length} total conversations`);
    
    // Group by conversation ID to find duplicates
    const conversationMap = new Map();
    const duplicates = [];
    
    allConversations.forEach(convo => {
      const existing = conversationMap.get(convo.id);
      if (!existing) {
        conversationMap.set(convo.id, convo);
      } else {
        // This is a duplicate
        duplicates.push(convo);
      }
    });
    
    console.log(`Found ${duplicates.length} duplicate conversations`);
    
    if (duplicates.length === 0) {
      console.log('✅ No duplicates found. Database is clean!');
      return;
    }
    
    // For each duplicate, decide which one to keep
    const toDelete = [];
    const toKeep = [];
    
    duplicates.forEach(duplicate => {
      const original = conversationMap.get(duplicate.id);
      
      // Compare last message times
      const duplicateTime = duplicate.lastMessageAt || duplicate.createdAt;
      const originalTime = original.lastMessageAt || original.createdAt;
      
      if (duplicateTime > originalTime) {
        // Duplicate is newer, keep it and delete original
        toDelete.push(original);
        conversationMap.set(duplicate.id, duplicate);
      } else {
        // Original is newer, keep it and delete duplicate
        toDelete.push(duplicate);
      }
    });
    
    console.log(`Will delete ${toDelete.length} older duplicates`);
    console.log(`Will keep ${toKeep.length} newer duplicates`);
    
    // Delete the older duplicates
    for (const convo of toDelete) {
      await db.delete(schema.conversations)
        .where(eq(schema.conversations.id, convo.id));
      
      // Also delete related records
      await db.delete(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, convo.id));
      
      await db.delete(schema.messages)
        .where(eq(schema.messages.conversationId, convo.id));
      
      await db.delete(schema.messageReads)
        .where(eq(schema.messageReads.conversationId, convo.id));
      
      console.log(`Deleted duplicate conversation: ${convo.id}`);
    }
    
    console.log('✅ Cleanup completed successfully!');
    console.log(`Deleted ${toDelete.length} duplicate conversations`);
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    throw error;
  }
}

// Run the cleanup
cleanupDuplicateConversations()
  .then(() => {
    console.log('🎉 Cleanup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Cleanup failed:', error);
    process.exit(1);
  });
