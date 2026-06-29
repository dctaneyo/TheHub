import * as Sentry from "@sentry/nextjs";

interface CronRunOptions {
  /** Additional attempts after the first failure. Default 2 (3 attempts total). */
  retries?: number;
  /** Delay between attempts, in ms. Default 60s. */
  retryDelayMs?: number;
}

/**
 * Runs a scheduled job with retry-then-alert semantics. The cron jobs in
 * server.ts previously caught their own errors and only console.error'd —
 * a failed backup or cleanup had no second chance and nobody found out
 * until someone happened to check the logs. This:
 *   1. Retries transient failures (a brief disk/DB hiccup) before giving up.
 *   2. Reports to Sentry (already configured for the app, see
 *      instrumentation.ts) only after retries are exhausted, so a human
 *      actually gets paged instead of the failure sitting silently in logs.
 */
export async function runCronJob(
  name: string,
  fn: () => Promise<unknown>,
  options: CronRunOptions = {}
): Promise<void> {
  const { retries = 2, retryDelayMs = 60_000 } = options;
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      await fn();
      if (attempt > 0) console.log(`✅ ${name} succeeded on retry ${attempt}`);
      return;
    } catch (error) {
      lastError = error;
      console.error(`❌ ${name} failed (attempt ${attempt + 1}/${retries + 1}):`, error);
      if (attempt < retries) {
        await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
      }
    }
  }

  console.error(`🚨 ${name} failed after ${retries + 1} attempts — reporting to Sentry`);
  try {
    Sentry.captureException(lastError, { tags: { cronJob: name } });
  } catch (sentryError) {
    // Reporting the failure must never itself produce an unhandled
    // rejection — the cron.schedule() callers don't await this function.
    console.error(`🚨 Sentry reporting for ${name} also failed:`, sentryError);
  }
}
