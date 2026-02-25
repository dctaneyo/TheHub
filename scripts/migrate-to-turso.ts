import Database from 'better-sqlite3';
import { createClient } from '@libsql/client';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../.env.local') });

const DB_PATH = process.env.DATABASE_PATH || './data/hub.db';
const TURSO_URL = process.env.TURSO_DATABASE_URL;
const TURSO_TOKEN = process.env.TURSO_AUTH_TOKEN;

if (!TURSO_URL || !TURSO_TOKEN) {
  console.error('❌ Missing Turso credentials. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN');
  process.exit(1);
}

const TABLES = [
  'locations',
  'arls',
  'sessions',
  'tasks',
  'taskCompletions',
  'messages',
  'conversations',
  'conversationMembers',
  'messageReads',
  'messageReactions',
  'forms',
  'dailyLeaderboard',
  'emergencyMessages',
  'notifications',
  'pendingSessions',
  'pushSubscriptions',
  'broadcasts',
  'broadcastViewers',
  'broadcastReactions',
  'broadcastMessages',
  'broadcastQuestions',
  'meetingAnalytics',
  'meetingParticipants',
  'scheduledMeetings',
];

async function migrateToTurso() {
  console.log('🚀 Starting migration from SQLite to Turso...\n');

  // Connect to both databases
  const sqliteDb = new Database(DB_PATH);
  const tursoClient = createClient({
    url: TURSO_URL,
    authToken: TURSO_TOKEN,
  });

  try {
    // Step 1: Export schema from SQLite
    console.log('📋 Step 1: Exporting schema from SQLite...');
    const schemaRows = sqliteDb.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='table' 
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
      ORDER BY name
    `).all() as Array<{ sql: string }>;

    // Step 2: Create tables in Turso
    console.log('🏗️  Step 2: Creating tables in Turso...');
    for (const row of schemaRows) {
      try {
        await tursoClient.execute(row.sql);
        const tableName = row.sql.match(/CREATE TABLE (?:IF NOT EXISTS )?["']?(\w+)["']?/i)?.[1];
        console.log(`  ✅ Created table: ${tableName}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          const tableName = row.sql.match(/CREATE TABLE (?:IF NOT EXISTS )?["']?(\w+)["']?/i)?.[1];
          console.log(`  ⏭️  Table already exists: ${tableName}`);
        } else {
          throw error;
        }
      }
    }

    // Step 3: Create indexes
    console.log('\n📑 Step 3: Creating indexes...');
    const indexes = sqliteDb.prepare(`
      SELECT sql FROM sqlite_master 
      WHERE type='index' 
      AND name NOT LIKE 'sqlite_%'
      AND sql IS NOT NULL
    `).all() as Array<{ sql: string }>;

    for (const row of indexes) {
      try {
        await tursoClient.execute(row.sql);
        const indexName = row.sql.match(/CREATE INDEX (?:IF NOT EXISTS )?["']?(\w+)["']?/i)?.[1];
        console.log(`  ✅ Created index: ${indexName}`);
      } catch (error: any) {
        if (error.message?.includes('already exists')) {
          const indexName = row.sql.match(/CREATE INDEX (?:IF NOT EXISTS )?["']?(\w+)["']?/i)?.[1];
          console.log(`  ⏭️  Index already exists: ${indexName}`);
        } else {
          console.warn(`  ⚠️  Failed to create index: ${error.message}`);
        }
      }
    }

    // Step 4: Migrate data table by table
    console.log('\n📦 Step 4: Migrating data...');
    let totalRows = 0;

    for (const tableName of TABLES) {
      try {
        // Check if table exists in SQLite
        const tableExists = sqliteDb.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name=?
        `).get(tableName);

        if (!tableExists) {
          console.log(`  ⏭️  Table ${tableName} doesn't exist in SQLite, skipping...`);
          continue;
        }

        // Get all rows from SQLite
        const rows = sqliteDb.prepare(`SELECT * FROM ${tableName}`).all();

        if (rows.length === 0) {
          console.log(`  ⏭️  ${tableName}: 0 rows (empty table)`);
          continue;
        }

        // Get column names from first row
        const columns = Object.keys(rows[0]);

        // Batch insert into Turso (1000 rows at a time)
        const batchSize = 1000;
        let migratedCount = 0;

        for (let i = 0; i < rows.length; i += batchSize) {
          const batch = rows.slice(i, i + batchSize);
          
          // Build parameterized INSERT statement
          const placeholders = columns.map(() => '?').join(',');
          const valuesSets = batch.map(() => `(${placeholders})`).join(',');
          const insertSql = `INSERT INTO ${tableName} (${columns.join(',')}) VALUES ${valuesSets}`;
          
          // Flatten all values for the batch
          const values = batch.flatMap(row => columns.map(col => (row as any)[col]));
          
          await tursoClient.execute({
            sql: insertSql,
            args: values,
          });

          migratedCount += batch.length;
        }

        totalRows += migratedCount;
        console.log(`  ✅ ${tableName}: ${migratedCount} rows migrated`);

      } catch (error: any) {
        console.error(`  ❌ Error migrating ${tableName}: ${error.message}`);
        throw error;
      }
    }

    // Step 5: Verify data integrity
    console.log('\n🔍 Step 5: Verifying data integrity...');
    let allMatch = true;

    for (const tableName of TABLES) {
      try {
        const tableExists = sqliteDb.prepare(`
          SELECT name FROM sqlite_master WHERE type='table' AND name=?
        `).get(tableName);

        if (!tableExists) continue;

        const sqliteCount = (sqliteDb.prepare(`SELECT COUNT(*) as count FROM ${tableName}`).get() as any).count;
        const tursoResult = await tursoClient.execute(`SELECT COUNT(*) as count FROM ${tableName}`);
        const tursoCount = tursoResult.rows[0][0];

        if (sqliteCount === tursoCount) {
          console.log(`  ✅ ${tableName}: ${sqliteCount} rows (match)`);
        } else {
          console.error(`  ❌ ${tableName}: SQLite=${sqliteCount}, Turso=${tursoCount} (MISMATCH!)`);
          allMatch = false;
        }
      } catch (error: any) {
        console.error(`  ❌ Error verifying ${tableName}: ${error.message}`);
        allMatch = false;
      }
    }

    console.log('\n' + '='.repeat(60));
    if (allMatch) {
      console.log('✅ Migration completed successfully!');
      console.log(`📊 Total rows migrated: ${totalRows}`);
      console.log('🎉 All data verified - counts match between SQLite and Turso');
      console.log('\nNext steps:');
      console.log('1. Set TURSO_DATABASE_URL and TURSO_AUTH_TOKEN in Railway');
      console.log('2. Deploy to Railway');
      console.log('3. Monitor for any issues');
      console.log('4. Keep SQLite backup for 1 week, then remove');
    } else {
      console.error('❌ Migration completed with errors - data verification failed!');
      console.error('⚠️  DO NOT deploy to production until issues are resolved');
      process.exit(1);
    }

  } catch (error: any) {
    console.error('\n❌ Migration failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  } finally {
    sqliteDb.close();
    tursoClient.close();
  }
}

// Run migration
migrateToTurso();
