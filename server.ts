import { createServer } from "http";
import { parse } from "url";
import next from "next";
import cron from "node-cron";
import { initSocketServer } from "./src/lib/socket-server";
import { createBackup } from "./scripts/backup-database";

const dev = process.env.NODE_ENV !== "production";
const hostname = "0.0.0.0";
const port = parseInt(process.env.PORT || "3000", 10);

const app = next({ dev, hostname, port });
const handle = app.getRequestHandler();

app.prepare().then(() => {
  console.log("✅ Next.js app is ready");
  const httpServer = createServer((req, res) => {
    const parsedUrl = parse(req.url!, true);
    handle(req, res, parsedUrl);
  });

  // Attach Socket.io to the same HTTP server
  initSocketServer(httpServer);

  // Setup automated backups (only in production)
  if (!dev) {
    console.log('📅 Setting up automated backup schedule...');
    
    // Daily backup at 2 AM
    cron.schedule('0 2 * * *', async () => {
      console.log('🔄 Running scheduled daily backup...');
      try {
        await createBackup('daily');
      } catch (error) {
        console.error('❌ Scheduled daily backup failed:', error);
      }
    });

    // Weekly backup on Sunday at 3 AM
    cron.schedule('0 3 * * 0', async () => {
      console.log('🔄 Running scheduled weekly backup...');
      try {
        await createBackup('weekly');
      } catch (error) {
        console.error('❌ Scheduled weekly backup failed:', error);
      }
    });

    // Monthly backup on the 1st at 4 AM
    cron.schedule('0 4 1 * *', async () => {
      console.log('🔄 Running scheduled monthly backup...');
      try {
        await createBackup('monthly');
      } catch (error) {
        console.error('❌ Scheduled monthly backup failed:', error);
      }
    });

    console.log('✅ Automated backups configured:');
    console.log('   - Daily: 2:00 AM (keep 30 days)');
    console.log('   - Weekly: Sunday 3:00 AM (keep 12 weeks)');
    console.log('   - Monthly: 1st of month 4:00 AM (keep 12 months)');
  }

  httpServer.listen(port, hostname, () => {
    console.log(`🚀 Server ready on http://${hostname}:${port}`);
  });
});
