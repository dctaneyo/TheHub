import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs/promises';
import path from 'path';

const execAsync = promisify(exec);

const DB_PATH = process.env.DATABASE_PATH || './data/hub.db';
const BACKUP_DIR = './data/backups';

interface BackupOptions {
  type: 'daily' | 'weekly' | 'monthly';
  keepCount: number;
}

const BACKUP_CONFIGS: Record<string, BackupOptions> = {
  daily: { type: 'daily', keepCount: 30 },
  weekly: { type: 'weekly', keepCount: 12 },
  monthly: { type: 'monthly', keepCount: 12 },
};

async function createBackup(type: 'daily' | 'weekly' | 'monthly' = 'daily') {
  try {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeStr = new Date().toISOString().replace(/[:.]/g, '-').split('T')[1].split('.')[0];
    const backupName = `hub-${type}-${timestamp}-${timeStr}.db`;
    const backupPath = path.join(BACKUP_DIR, backupName);

    // Ensure backup directory exists
    await fs.mkdir(BACKUP_DIR, { recursive: true });

    console.log(`🔄 Creating ${type} backup: ${backupName}`);

    // Check if database exists
    try {
      await fs.access(DB_PATH);
    } catch {
      console.log('⚠️  Database file not found, skipping backup');
      return;
    }

    // Create backup using SQLite .backup command
    await execAsync(`sqlite3 "${DB_PATH}" ".backup '${backupPath}'"`);

    // Get backup file size
    const stats = await fs.stat(backupPath);
    const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);

    console.log(`✅ Backup created: ${backupName} (${sizeMB} MB)`);

    // Compress backup
    console.log('🗜️  Compressing backup...');
    await execAsync(`gzip "${backupPath}"`);
    const compressedPath = `${backupPath}.gz`;
    const compressedStats = await fs.stat(compressedPath);
    const compressedSizeMB = (compressedStats.size / (1024 * 1024)).toFixed(2);
    console.log(`✅ Backup compressed: ${backupName}.gz (${compressedSizeMB} MB)`);

    // Cleanup old backups
    await cleanupOldBackups(type, BACKUP_CONFIGS[type].keepCount);

    return compressedPath;
  } catch (error) {
    console.error('❌ Backup failed:', error);
    throw error;
  }
}

async function cleanupOldBackups(type: string, keepCount: number) {
  try {
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files
      .filter(f => f.startsWith(`hub-${type}-`) && f.endsWith('.gz'))
      .map(f => ({
        name: f,
        path: path.join(BACKUP_DIR, f),
      }));

    // Sort by name (which includes timestamp)
    backupFiles.sort((a, b) => b.name.localeCompare(a.name));

    // Delete old backups
    const toDelete = backupFiles.slice(keepCount);
    if (toDelete.length > 0) {
      console.log(`🗑️  Removing ${toDelete.length} old ${type} backup(s)...`);
      for (const file of toDelete) {
        await fs.unlink(file.path);
        console.log(`   Deleted: ${file.name}`);
      }
    }
  } catch (error) {
    console.error('⚠️  Cleanup failed:', error);
  }
}

async function listBackups() {
  try {
    await fs.mkdir(BACKUP_DIR, { recursive: true });
    const files = await fs.readdir(BACKUP_DIR);
    const backupFiles = files.filter(f => f.endsWith('.gz'));

    if (backupFiles.length === 0) {
      console.log('No backups found');
      return;
    }

    console.log('\n📦 Available backups:\n');
    
    const backupsByType: Record<string, string[]> = {
      daily: [],
      weekly: [],
      monthly: [],
    };

    for (const file of backupFiles) {
      const filePath = path.join(BACKUP_DIR, file);
      const stats = await fs.stat(filePath);
      const sizeMB = (stats.size / (1024 * 1024)).toFixed(2);
      const date = new Date(stats.mtime).toLocaleString();

      if (file.includes('-daily-')) backupsByType.daily.push(`  ${file} (${sizeMB} MB) - ${date}`);
      else if (file.includes('-weekly-')) backupsByType.weekly.push(`  ${file} (${sizeMB} MB) - ${date}`);
      else if (file.includes('-monthly-')) backupsByType.monthly.push(`  ${file} (${sizeMB} MB) - ${date}`);
    }

    for (const [type, files] of Object.entries(backupsByType)) {
      if (files.length > 0) {
        console.log(`${type.toUpperCase()} (${files.length}):`);
        files.forEach(f => console.log(f));
        console.log('');
      }
    }
  } catch (error) {
    console.error('❌ Failed to list backups:', error);
  }
}

async function restoreBackup(backupFile: string) {
  try {
    const backupPath = path.join(BACKUP_DIR, backupFile);

    // Check if backup exists
    try {
      await fs.access(backupPath);
    } catch {
      console.error(`❌ Backup file not found: ${backupFile}`);
      return;
    }

    console.log(`⚠️  WARNING: This will overwrite the current database!`);
    console.log(`📦 Restoring from: ${backupFile}`);

    // Create a safety backup of current database
    const safetyBackup = `${DB_PATH}.before-restore-${Date.now()}`;
    console.log(`💾 Creating safety backup: ${path.basename(safetyBackup)}`);
    await execAsync(`cp "${DB_PATH}" "${safetyBackup}"`);

    // Decompress if needed
    let sourceFile = backupPath;
    if (backupFile.endsWith('.gz')) {
      console.log('🗜️  Decompressing backup...');
      const decompressed = backupPath.replace('.gz', '');
      await execAsync(`gunzip -c "${backupPath}" > "${decompressed}"`);
      sourceFile = decompressed;
    }

    // Restore database
    console.log('🔄 Restoring database...');
    await execAsync(`cp "${sourceFile}" "${DB_PATH}"`);

    // Cleanup decompressed file if we created it
    if (sourceFile !== backupPath) {
      await fs.unlink(sourceFile);
    }

    console.log('✅ Database restored successfully!');
    console.log(`💡 Safety backup saved at: ${safetyBackup}`);
  } catch (error) {
    console.error('❌ Restore failed:', error);
  }
}

// CLI interface
const command = process.argv[2];
const arg = process.argv[3];

(async () => {
  switch (command) {
    case 'backup':
      await createBackup((arg as any) || 'daily');
      break;
    case 'list':
      await listBackups();
      break;
    case 'restore':
      if (!arg) {
        console.error('❌ Please specify a backup file to restore');
        console.log('Usage: npm run db:restore -- <backup-file>');
        process.exit(1);
      }
      await restoreBackup(arg);
      break;
    default:
      console.log('Usage:');
      console.log('  npm run db:backup           - Create daily backup');
      console.log('  npm run db:backup -- weekly - Create weekly backup');
      console.log('  npm run db:backup -- monthly - Create monthly backup');
      console.log('  npm run db:list-backups     - List all backups');
      console.log('  npm run db:restore -- <file> - Restore from backup');
  }
})();

export { createBackup, listBackups, restoreBackup };
