// PIN Reset Script for Railway SSH
// Run: node scripts/reset-pins.js
//
// Resets all PINs to 4-digit defaults:
//   - Locations: PIN = last 4 digits of store number (e.g. H730272 → 0272)
//   - ARLs: PIN = last 4 digits of their user_id (same as user_id)

const Database = require('better-sqlite3');
const { hashSync } = require('bcryptjs');

const db = new Database('/data/hub.db');

console.log('=== PIN Reset Script ===\n');

// Reset location PINs to last 4 of store number
console.log('Resetting location PINs...');
const locations = db.prepare('SELECT id, name, store_number, user_id FROM locations').all();
for (const loc of locations) {
  const newPin = loc.store_number.slice(-4);
  const hash = hashSync(newPin, 10);
  db.prepare('UPDATE locations SET pin_hash = ? WHERE id = ?').run(hash, loc.id);
  console.log('  ' + loc.name + ' (' + loc.store_number + '): PIN = ' + newPin);
}

// Reset ARL PINs to their user_id
console.log('\nResetting ARL PINs...');
const arls = db.prepare('SELECT id, name, user_id FROM arls').all();
for (const arl of arls) {
  const newPin = arl.user_id;
  const hash = hashSync(newPin, 10);
  db.prepare('UPDATE arls SET pin_hash = ? WHERE id = ?').run(hash, arl.id);
  console.log('  ' + arl.name + ' (' + arl.user_id + '): PIN = ' + newPin);
}

console.log('\n=== Done! All PINs reset. ===');
console.log('Locations: PIN = last 4 digits of store number');
console.log('ARLs: PIN = same as User ID');
console.log('\nPlease have users change their PINs after logging in.');

db.close();
