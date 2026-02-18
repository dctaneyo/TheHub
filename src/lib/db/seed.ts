import Database from "better-sqlite3";
import { drizzle } from "drizzle-orm/better-sqlite3";
import * as schema from "./schema";
import { hashSync } from "bcryptjs";
import { v4 as uuid } from "uuid";
import path from "path";
import fs from "fs";

const DB_PATH = process.env.DATABASE_PATH || path.join(process.cwd(), "data", "hub.db");
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const sqlite = new Database(DB_PATH);
sqlite.pragma("journal_mode = WAL");
sqlite.pragma("foreign_keys = ON");
const db = drizzle(sqlite, { schema });

async function seed() {
  console.log("🌱 Seeding database...");

  // Create tables manually via raw SQL (Drizzle push would be better but this works for seed)
  sqlite.exec(`
    CREATE TABLE IF NOT EXISTS locations (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      store_number TEXT NOT NULL UNIQUE,
      address TEXT,
      email TEXT,
      user_id TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS arls (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT,
      user_id TEXT NOT NULL UNIQUE,
      pin_hash TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'arl',
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      session_code TEXT,
      user_type TEXT NOT NULL,
      user_id TEXT NOT NULL,
      token TEXT NOT NULL,
      socket_id TEXT,
      is_online INTEGER NOT NULL DEFAULT 0,
      last_seen TEXT NOT NULL,
      device_type TEXT,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS tasks (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      type TEXT NOT NULL DEFAULT 'task',
      priority TEXT NOT NULL DEFAULT 'normal',
      due_time TEXT NOT NULL,
      due_date TEXT,
      is_recurring INTEGER NOT NULL DEFAULT 0,
      recurring_type TEXT,
      recurring_days TEXT,
      location_id TEXT,
      created_by TEXT NOT NULL,
      is_hidden INTEGER NOT NULL DEFAULT 0,
      points INTEGER NOT NULL DEFAULT 10,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS task_completions (
      id TEXT PRIMARY KEY,
      task_id TEXT NOT NULL,
      location_id TEXT NOT NULL,
      completed_at TEXT NOT NULL,
      completed_date TEXT NOT NULL,
      notes TEXT,
      points_earned INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      sender_type TEXT NOT NULL,
      sender_id TEXT NOT NULL,
      sender_name TEXT NOT NULL DEFAULT '',
      content TEXT NOT NULL,
      message_type TEXT NOT NULL DEFAULT 'text',
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL DEFAULT 'direct',
      name TEXT,
      participant_a_id TEXT,
      participant_a_type TEXT,
      participant_b_id TEXT,
      participant_b_type TEXT,
      last_message_at TEXT,
      last_message_preview TEXT,
      created_by TEXT,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS conversation_members (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      member_id TEXT NOT NULL,
      member_type TEXT NOT NULL,
      joined_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS message_reads (
      id TEXT PRIMARY KEY,
      message_id TEXT NOT NULL,
      reader_type TEXT NOT NULL,
      reader_id TEXT NOT NULL,
      read_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS forms (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      description TEXT,
      category TEXT NOT NULL DEFAULT 'general',
      file_name TEXT NOT NULL,
      file_path TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      uploaded_by TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS location_scores (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      date TEXT NOT NULL,
      points_earned INTEGER NOT NULL DEFAULT 0,
      tasks_completed INTEGER NOT NULL DEFAULT 0,
      tasks_missed INTEGER NOT NULL DEFAULT 0,
      streak INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS notifications (
      id TEXT PRIMARY KEY,
      location_id TEXT NOT NULL,
      type TEXT NOT NULL,
      title TEXT NOT NULL,
      body TEXT,
      reference_id TEXT,
      is_read INTEGER NOT NULL DEFAULT 0,
      is_dismissed INTEGER NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS emergency_messages (
      id TEXT PRIMARY KEY,
      message TEXT NOT NULL,
      sent_by TEXT NOT NULL,
      sent_by_name TEXT NOT NULL,
      is_active INTEGER NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL,
      expires_at TEXT
    );
  `);

  // Seed demo data
  const now = new Date().toISOString();

  // Create demo ARL (admin)
  const adminId = uuid();
  const arlId = uuid();
  db.insert(schema.arls).values([
    {
      id: adminId,
      name: "Admin User",
      email: "admin@thehub.app",
      userId: "000001",
      pinHash: hashSync("123456", 10),
      role: "admin",
      createdAt: now,
      updatedAt: now,
    },
    {
      id: arlId,
      name: "Jane Smith",
      email: "jane@thehub.app",
      userId: "000002",
      pinHash: hashSync("123456", 10),
      role: "arl",
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  // Create demo locations
  const loc1Id = uuid();
  const loc2Id = uuid();
  const loc3Id = uuid();
  db.insert(schema.locations).values([
    {
      id: loc1Id,
      name: "Downtown Location",
      storeNumber: "1001",
      address: "123 Main St",
      email: "downtown@thehub.app",
      userId: "100001",
      pinHash: hashSync("111111", 10),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: loc2Id,
      name: "Westside Location",
      storeNumber: "1002",
      address: "456 West Ave",
      email: "westside@thehub.app",
      userId: "100002",
      pinHash: hashSync("222222", 10),
      createdAt: now,
      updatedAt: now,
    },
    {
      id: loc3Id,
      name: "Airport Location",
      storeNumber: "1003",
      address: "789 Airport Blvd",
      email: "airport@thehub.app",
      userId: "100003",
      pinHash: hashSync("333333", 10),
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  // Create demo tasks
  const taskIds = [uuid(), uuid(), uuid(), uuid(), uuid(), uuid(), uuid(), uuid()];
  db.insert(schema.tasks).values([
    {
      id: taskIds[0],
      title: "Morning Line Check",
      description: "Check all food line temperatures and log readings. Ensure all items are within safe temperature range.",
      type: "task",
      priority: "high",
      dueTime: "06:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[1],
      title: "Lobby Floor Sweep & Mop",
      description: "Sweep and mop the entire lobby area. Pay special attention to corners and under tables.",
      type: "cleaning",
      priority: "normal",
      dueTime: "07:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 10,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[2],
      title: "Restroom Deep Clean",
      description: "Full restroom cleaning including toilets, sinks, mirrors, floors, and restocking supplies.",
      type: "cleaning",
      priority: "high",
      dueTime: "09:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 20,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[3],
      title: "Lunch Rush Prep",
      description: "Ensure all stations are fully stocked and ready for lunch rush. Check fryer oil levels.",
      type: "task",
      priority: "urgent",
      dueTime: "10:30",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[4],
      title: "Afternoon Temp Check",
      description: "Second temperature check of the day. Log all readings in the temperature log.",
      type: "task",
      priority: "high",
      dueTime: "14:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 15,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[5],
      title: "Kitchen Deep Clean",
      description: "Deep clean all kitchen surfaces, equipment, and prep areas. Degrease fryers if needed.",
      type: "cleaning",
      priority: "normal",
      dueTime: "16:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 25,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[6],
      title: "Evening Inventory Count",
      description: "Count remaining inventory for key items. Submit counts via the inventory form.",
      type: "task",
      priority: "normal",
      dueTime: "20:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 10,
      createdAt: now,
      updatedAt: now,
    },
    {
      id: taskIds[7],
      title: "Closing Checklist",
      description: "Complete all closing procedures: lock doors, turn off equipment, set alarm, final walkthrough.",
      type: "task",
      priority: "high",
      dueTime: "22:00",
      isRecurring: true,
      recurringDays: JSON.stringify(["mon", "tue", "wed", "thu", "fri", "sat", "sun"]),
      createdBy: adminId,
      points: 20,
      createdAt: now,
      updatedAt: now,
    },
  ]).run();

  // Create a Global Chat conversation
  const globalConvId = uuid();
  db.insert(schema.conversations).values({
    id: globalConvId,
    type: "global",
    name: "Global Chat",
    createdBy: adminId,
    createdAt: now,
  }).run();

  // Add all locations + ARLs as members of global chat
  for (const locId of [loc1Id, loc2Id, loc3Id]) {
    db.insert(schema.conversationMembers).values({
      id: uuid(),
      conversationId: globalConvId,
      memberId: locId,
      memberType: "location",
      joinedAt: now,
    }).run();
  }
  for (const arlMemberId of [adminId, arlId]) {
    db.insert(schema.conversationMembers).values({
      id: uuid(),
      conversationId: globalConvId,
      memberId: arlMemberId,
      memberType: "arl",
      joinedAt: now,
    }).run();
  }

  // Create direct ARL↔location conversations
  for (const locId of [loc1Id, loc2Id, loc3Id]) {
    const convId = uuid();
    db.insert(schema.conversations).values({
      id: convId,
      type: "direct",
      participantAId: arlId,
      participantAType: "arl",
      participantBId: locId,
      participantBType: "location",
      createdAt: now,
    }).run();
    db.insert(schema.conversationMembers).values([
      { id: uuid(), conversationId: convId, memberId: arlId, memberType: "arl", joinedAt: now },
      { id: uuid(), conversationId: convId, memberId: locId, memberType: "location", joinedAt: now },
    ]).run();
  }

  console.log("✅ Database seeded successfully!");
  console.log("");
  console.log("Demo Credentials:");
  console.log("─────────────────────────────────");
  console.log("Admin:        User ID: 000001  PIN: 123456");
  console.log("ARL (Jane):   User ID: 000002  PIN: 123456");
  console.log("Downtown:     User ID: 100001  PIN: 111111");
  console.log("Westside:     User ID: 100002  PIN: 222222");
  console.log("Airport:      User ID: 100003  PIN: 333333");
  console.log("─────────────────────────────────");
}

seed().catch(console.error);
