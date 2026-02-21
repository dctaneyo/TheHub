import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth";
import { db, schema } from "@/lib/db";
import { eq, desc, sql } from "drizzle-orm";

interface Conversation {
  id: string;
  type: string;
  name: string | null;
  participantAId: string | null;
  participantAType: string | null;
  participantBId: string | null;
  participantBType: string | null;
  lastMessageAt: string | null;
  lastMessagePreview: string | null;
  createdBy: string | null;
  deletedBy: string;
  createdAt: string;
}

// Admin-only endpoint to clean up duplicate conversations
export async function POST(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    console.log('🧹 Starting duplicate conversation cleanup...');
    
    // Get all conversations
    const allConversations: Conversation[] = db.select().from(schema.conversations).all();
    console.log(`Found ${allConversations.length} total conversations`);
    
    // Group by conversation ID to find duplicates
    const conversationMap = new Map<string, Conversation>();
    const duplicates: Conversation[] = [];
    
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
      return NextResponse.json({ 
        message: "No duplicates found. Database is clean!",
        deleted: 0
      });
    }
    
    // For each duplicate, decide which one to keep
    const toDelete: Conversation[] = [];
    
    duplicates.forEach(duplicate => {
      const original = conversationMap.get(duplicate.id);
      
      if (!original) return;
      
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
    
    // Delete the older duplicates
    let deletedCount = 0;
    for (const convo of toDelete) {
      // Delete related records first (foreign key constraints)
      db.delete(schema.messageReads)
        .where(eq(schema.messageReads.messageId, sql`in (select id from ${schema.messages} where conversationId = ${convo.id})`)).run();
      
      db.delete(schema.messages)
        .where(eq(schema.messages.conversationId, convo.id)).run();
      
      db.delete(schema.conversationMembers)
        .where(eq(schema.conversationMembers.conversationId, convo.id)).run();
      
      // Delete the conversation
      db.delete(schema.conversations)
        .where(eq(schema.conversations.id, convo.id)).run();
      
      deletedCount++;
      console.log(`Deleted duplicate conversation: ${convo.id}`);
    }
    
    console.log('✅ Cleanup completed successfully!');
    
    return NextResponse.json({ 
      message: "Cleanup completed successfully!",
      deleted: deletedCount,
      totalBefore: allConversations.length,
      totalAfter: allConversations.length - deletedCount
    });
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
    return NextResponse.json({ 
      error: "Internal server error during cleanup",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}

// GET method to check for duplicates without deleting
export async function GET(req: NextRequest) {
  try {
    const session = await getSession();
    if (!session || session.userType !== "arl") {
      return NextResponse.json({ error: "Unauthorized - Admin access required" }, { status: 401 });
    }

    const allConversations: Conversation[] = db.select().from(schema.conversations).all();
    
    // Find duplicates
    const conversationMap = new Map<string, Conversation>();
    const duplicates: Conversation[] = [];
    
    allConversations.forEach(convo => {
      const existing = conversationMap.get(convo.id);
      if (!existing) {
        conversationMap.set(convo.id, convo);
      } else {
        duplicates.push(convo);
      }
    });
    
    return NextResponse.json({ 
      totalConversations: allConversations.length,
      duplicateCount: duplicates.length,
      duplicates: duplicates.map(d => ({
        id: d.id,
        type: d.type,
        name: d.name,
        createdAt: d.createdAt,
        lastMessageAt: d.lastMessageAt
      }))
    });
    
  } catch (error) {
    console.error('❌ Error checking duplicates:', error);
    return NextResponse.json({ 
      error: "Internal server error",
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
