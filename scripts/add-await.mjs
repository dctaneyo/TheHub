#!/usr/bin/env node
/**
 * Mechanical transformation: add `await` to all sync db/sqlite calls
 * for the better-sqlite3 → libsql migration.
 * 
 * Patterns handled:
 * 1. `= db.select()...all()` → `= await db.select()...all()`
 * 2. `= db.select()...get()` → `= await db.select()...get()`  
 * 3. `db.insert()...run()` → `await db.insert()...run()`
 * 4. `= db\n  .select()...` (multiline) → `= await db\n`
 * 5. `.all().filter(` / `.all().map(` → `(await ...).filter(`
 * 6. `sqlite.prepare()...` → `await sqlite.prepare()...`
 * 7. `sqlite.exec(` → `await sqlite.execute(`
 */
import { readFileSync, writeFileSync } from 'fs';
import { execSync } from 'child_process';

// Get all files that import from @/lib/db or ./db or ../db
const files = execSync(
  `grep -rl "from.*@/lib/db\\|from.*['\\"]\\.\\./db['\\"]\\.\\|from.*['\\"]\\./db['\\"]\\.\\|from.*['\\"]\\.\\./db['\\"]\$\\|from.*['\\"]\\./db['\\"]\$" src/ --include="*.ts" --include="*.tsx"`,
  { cwd: process.cwd(), encoding: 'utf8' }
).trim().split('\n').filter(Boolean).filter(f => !f.includes('src/lib/db/'));

console.log(`Processing ${files.length} files...`);

let totalChanges = 0;

for (const file of files) {
  const original = readFileSync(file, 'utf8');
  const lines = original.split('\n');
  let changed = false;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trimStart();
    const indent = line.slice(0, line.length - trimmed.length);
    
    // Skip lines that already have await before db/sqlite
    if (/await\s+(db\.|sqlite\.)/.test(line)) continue;
    // Skip import lines
    if (trimmed.startsWith('import ')) continue;
    // Skip comments
    if (trimmed.startsWith('//') || trimmed.startsWith('*') || trimmed.startsWith('/*')) continue;
    
    // Pattern: `.all().filter(` or `.all().map(` or `.all().length` — need (await ...).chain()
    // This is the trickiest pattern - the db call result is immediately chained
    if (/\.\s*all\(\)\s*\.\s*(filter|map|find|some|every|reduce|forEach|length|flatMap|sort)\b/.test(line) && /\bdb\s*[\.\n]/.test(line)) {
      // Find the db. start and .all() end
      const dbMatch = line.match(/^(\s*(?:const|let|var)\s+\w+\s*=\s*)(\bdb[\s\S]*?\.all\(\))(\..*)/);
      if (dbMatch) {
        lines[i] = `${dbMatch[1]}(await ${dbMatch[2]})${dbMatch[3]}`;
        changed = true;
        continue;
      }
    }
    
    // Pattern: assignment with db on same line: `const x = db.select()...`
    if (/^(\s*(?:const|let|var)\s+\S+\s*=\s*)db\./.test(line) && !line.includes('await')) {
      lines[i] = line.replace(/^(\s*(?:const|let|var)\s+\S+\s*=\s*)db\./, '$1await db.');
      changed = true;
      continue;
    }
    
    // Pattern: assignment with db on next line (multiline chain): `const x = db`
    if (/^(\s*(?:const|let|var)\s+\S+\s*=\s*)db\s*$/.test(line) && !line.includes('await')) {
      lines[i] = line.replace(/^(\s*(?:const|let|var)\s+\S+\s*=\s*)db\s*$/, '$1await db');
      changed = true;
      continue;
    }
    
    // Pattern: standalone db statement: `db.insert(...)...run();` or `db.delete(...)...`
    if (/^\s+db\./.test(line) && !line.includes('await') && !line.includes('import')) {
      lines[i] = line.replace(/^(\s+)db\./, '$1await db.');
      changed = true;
      continue;
    }
    
    // Pattern: assignment with sqlite: `const x = sqlite.prepare(...)`
    if (/^(\s*(?:const|let|var)\s+\S+\s*=\s*)sqlite\./.test(line) && !line.includes('await')) {
      lines[i] = line.replace(/^(\s*(?:const|let|var)\s+\S+\s*=\s*)sqlite\./, '$1await sqlite.');
      changed = true;
      continue;
    }
    
    // Pattern: standalone sqlite statement: `sqlite.prepare(...)...run();`
    if (/^\s+sqlite\./.test(line) && !line.includes('await') && !line.includes('import')) {
      lines[i] = line.replace(/^(\s+)sqlite\./, '$1await sqlite.');
      changed = true;
      continue;
    }
    
    // Pattern: return db.select()... → return await db.select()...
    if (/^\s+return\s+db\./.test(line) && !line.includes('await')) {
      lines[i] = line.replace(/^(\s+return\s+)db\./, '$1await db.');
      changed = true;
      continue;
    }
    
    // Pattern: return sqlite.prepare()... → return await sqlite...
    if (/^\s+return\s+sqlite\./.test(line) && !line.includes('await')) {
      lines[i] = line.replace(/^(\s+return\s+)sqlite\./, '$1await sqlite.');
      changed = true;
      continue;
    }
  }
  
  if (changed) {
    writeFileSync(file, lines.join('\n'));
    totalChanges++;
    console.log(`  ✓ ${file}`);
  }
}

console.log(`\nDone: ${totalChanges}/${files.length} files modified.`);
