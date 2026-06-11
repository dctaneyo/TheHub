#!/usr/bin/env node

/**
 * Auto-seeds test data if the database is empty.
 * Runs after migrations to ensure test data is available on fresh deployments.
 */

const Database = require('better-sqlite3');
const bcrypt = require('bcryptjs');
const { v4: uuid } = require('uuid');
const path = require('path');

console.log('Checking if database needs seeding...');

try {
  const dbPath = process.env.DATABASE_PATH || './data/hub.db';
  const db = new Database(dbPath);

  // Check if locations table exists and has any data
  let hasLocations = false;
  let hasArls = false;

  try {
    const locationCount = db.prepare('SELECT COUNT(*) as count FROM locations').get();
    hasLocations = locationCount.count > 0;
  } catch (err) {
    // Table doesn't exist or other error
    console.log('  ℹ️  locations table not found or inaccessible');
  }

  try {
    const arlCount = db.prepare('SELECT COUNT(*) as count FROM arls').get();
    hasArls = arlCount.count > 0;
  } catch (err) {
    // Table doesn't exist or other error
    console.log('  ℹ️  arls table not found or inaccessible');
  }

  // If we have data, no need to seed
  if (hasLocations || hasArls) {
    console.log('✅ Database already contains data, skipping seed');
    db.close();
    return;
  }

  console.log('🌱 Database is empty, seeding test data...');

  // Get tenant ID or use default
  const tenantId = process.env.TENANT_ID || 'kazi';

  // Create test location
  const locationId = uuid();
  const locationPinHash = bcrypt.hashSync('1111', 10);
  
  db.prepare(`
    INSERT INTO locations (
      id, tenant_id, name, store_number, user_id, pin_hash, 
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    locationId,
    tenantId,
    'Test Store',
    'TEST001',
    '1111',
    locationPinHash,
    new Date().toISOString(),
    new Date().toISOString()
  );

  // Create test ARL
  const arlId = uuid();
  const arlPinHash = bcrypt.hashSync('2222', 10);
  
  db.prepare(`
    INSERT INTO arls (
      id, tenant_id, name, email, user_id, pin_hash, role,
      is_active, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?, ?)
  `).run(
    arlId,
    tenantId,
    'Test ARL',
    'arl@test.com',
    '2222',
    arlPinHash,
    'arl',
    new Date().toISOString(),
    new Date().toISOString()
  );

  console.log('');
  console.log('🎉 Test data seeded successfully!');
  console.log('');
  console.log('Test Credentials:');
  console.log('  Location User:  User ID: 1111  PIN: 1111');
  console.log('  ARL User:      User ID: 2222  PIN: 2222');
  console.log('');

  db.close();

} catch (error) {
  console.error('❌ Auto-seed failed:', error.message);
  // Don't exit with error — let the app start anyway
  console.log('⚠️  Continuing with application startup...');
}