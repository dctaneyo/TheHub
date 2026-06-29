import { createServer } from "http";
import { parse } from "url";
import next from "next";
import cron from "node-cron";
import { initSocketServer } from "./src/lib/socket-server";
import { createBackup } from "./scripts/backup-database";
import { startTaskNotificationScheduler } from "./src/lib/task-notification-scheduler";
import { cleanupStaleData } from "./src/lib/cleanup";
import { processScheduledReports } from "./src/lib/report-generator";
import { ensureIndexes } from "./src/lib/ensure-indexes";
import { runCronJob } from "./src/lib/cron-runner";

// This custom server (dist/server.js) is the PRODUCTION entrypoint — local
// development uses `next dev` directly. Default to production mode and only run
// the Next dev compiler/HMR when NODE_ENV is explicitly "development". (A bare
// `!== "production"` check meant an unset NODE_ENV booted dev mode in prod,
// pulling in HMR + the dev overlay and breaking the CSP.)
const dev = process.env.NODE_ENV === "development";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  console.log("✅ Next.js app is ready");

  // Ensure critical DB indexes exist (idempotent)
  ensureIndexes();

  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.io to the same HTTP server
  initSocketServer(httpServer);

  // Start task notification scheduler (real-time WebSocket delivery)
  startTaskNotificationScheduler();

  // Setup automated backups (only in production)
  if (!dev) {
    console.log('📅 Setting up automated backup schedule...');
    
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', () => {
      console.log('🔄 Running scheduled daily backup...');
      runCronJob('daily-backup', () => createBackup('daily'));
    });

    // Weekly backup on Sunday at 3 AM
    cron.schedule('0 3 * * 0', () => {
      console.log('🔄 Running scheduled weekly backup...');
      runCronJob('weekly-backup', () => createBackup('weekly'));
    });

    // Monthly backup on the 1st at 4 AM
    cron.schedule('0 4 1 * *', () => {
      console.log('🔄 Running scheduled monthly backup...');
      runCronJob('monthly-backup', () => createBackup('monthly'));
    });

    // Daily stale data cleanup at 1:30 AM (before backup)
    cron.schedule('30 1 * * *', () => {
      console.log('🧹 Running scheduled data cleanup...');
      runCronJob('daily-cleanup', async () => {
        const result = await cleanupStaleData();
        console.log('✅ Cleanup complete:', result);
      });
    });

    // Process scheduled reports every hour
    cron.schedule('0 * * * *', () => {
      console.log('📊 Checking for due scheduled reports...');
      runCronJob('scheduled-reports', async () => {
        const result = await processScheduledReports();
        if (result.processed > 0 || result.errors > 0) {
          console.log(`📊 Reports: ${result.processed} processed, ${result.errors} errors`);
        }
      });
    });

    console.log('✅ Automated backups configured:');
    console.log('   - Daily cleanup: 1:30 AM (sessions, notifications, orphans)');
    console.log('   - Daily backup: 2:00 AM (keep 30 days)');
    console.log('   - Weekly: Sunday 3:00 AM (keep 12 weeks)');
    console.log('   - Monthly: 1st of month 4:00 AM (keep 12 months)');
    console.log('   - Reports: checked every hour');
  }

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
  });
});
