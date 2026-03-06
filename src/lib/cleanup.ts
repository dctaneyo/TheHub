import { sqlite } from "./db";
import { deleteOldNotifications } from "./notifications";

/**
 * Cleanup stale data — run on a daily cron schedule.
 *
 * Removes:
 *  - Expired sessions (older than 7 days past expiry)
 *  - Expired pending sessions
 *  - Old read notifications (30+ days)
 *  - Orphaned message reads for deleted messages
 */
export async function cleanupStaleData(): Promise<{
  sessions: number;
  pendingSessions: number;
  notifications: string;
}> {
  const now = new Date().toISOString();
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  // 1. Delete expired sessions (7 days past their expiry)
  let sessionsDeleted = 0;
  try {
    const result = await sqlite.prepare(
      `DELETE FROM sessions WHERE expires_at < ?`
    ).run(sevenDaysAgo);
    sessionsDeleted = result.rowsAffected;
    if (sessionsDeleted > 0) {
      console.log(`🧹 Cleaned up ${sessionsDeleted} expired sessions`);
    }
  } catch (err) {
    console.error("Session cleanup error:", err);
  }

  // 2. Delete expired pending sessions
  let pendingDeleted = 0;
  try {
    const result = await sqlite.prepare(
      `DELETE FROM pending_sessions WHERE expires_at < ?`
    ).run(now);
    pendingDeleted = result.rowsAffected;
    if (pendingDeleted > 0) {
      console.log(`🧹 Cleaned up ${pendingDeleted} expired pending sessions`);
    }
  } catch (err) {
    console.error("Pending session cleanup error:", err);
  }

  // 3. Delete old read notifications (30+ days old)
  let notifStatus = "ok";
  try {
    await deleteOldNotifications(30);
    console.log("🧹 Old notifications cleanup complete");
  } catch (err) {
    console.error("Notification cleanup error:", err);
    notifStatus = "error";
  }

  // 4. Cleanup orphaned message reads (where message no longer exists)
  try {
    const result = await sqlite.prepare(`
      DELETE FROM message_reads
      WHERE message_id NOT IN (SELECT id FROM messages)
    `).run();
    if (result.rowsAffected > 0) {
      console.log(`🧹 Cleaned up ${result.rowsAffected} orphaned message reads`);
    }
  } catch (err) {
    console.error("Orphaned message reads cleanup error:", err);
  }

  return {
    sessions: sessionsDeleted,
    pendingSessions: pendingDeleted,
    notifications: notifStatus,
  };
}
