// Reload diagnostics — survives the console clear that a full reload causes.
//
// Every in-app navigation/reload should call recordReload(reason) right before
// it happens. On the next load, logStartupDiagnostics() prints:
//   - the browser's navigation type (reload | navigate | back_forward), and
//   - the most recent in-app reload breadcrumbs.
//
// This lets us tell apart:
//   • an in-app reload (a breadcrumb exists, e.g. "build-update …"), vs
//   • an EXTERNAL reload (navigation type "reload" but NO breadcrumb) —
//     which points to the service worker, the browser, or the kiosk shell.

const KEY = "hub-reload-log";
const MAX = 12;

interface Breadcrumb {
  t: string;
  reason: string;
}

export function recordReload(reason: string): void {
  if (typeof window === "undefined") return;
  try {
    const log: Breadcrumb[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    log.push({ t: new Date().toISOString(), reason });
    while (log.length > MAX) log.shift();
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* ignore storage failures */
  }
}

export function logStartupDiagnostics(): void {
  if (typeof window === "undefined") return;
  try {
    let navType = "unknown";
    const navs = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    if (navs[0]?.type) navType = navs[0].type;

    // Measure the gap since the previous page load (reveals a recurring cadence
    // even when the reload is triggered externally and leaves no breadcrumb).
    const LOAD_KEY = "hub-last-load-ts";
    const now = Date.now();
    const prevLoad = Number(localStorage.getItem(LOAD_KEY) || 0);
    localStorage.setItem(LOAD_KEY, String(now));
    const sinceLastLoad = prevLoad ? Math.round((now - prevLoad) / 1000) : null;

    const log: Breadcrumb[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    console.log(
      `%c[Hub diag] page load — navigation type: ${navType}${
        sinceLastLoad != null ? `, ${sinceLastLoad}s since previous load` : ""
      }`,
      "color:#e4002b;font-weight:bold"
    );

    if (log.length > 0) {
      const last = log[log.length - 1];
      const ageS = Math.round((Date.now() - new Date(last.t).getTime()) / 1000);
      console.log(
        `[Hub diag] last in-app reload: "${last.reason}" (${ageS}s ago). Recent breadcrumbs:`,
        log
      );
    }

    // If the page reloaded recently but NO in-app breadcrumb was written just
    // before it, the trigger is external to app code.
    const lastCrumbAgeS = log.length
      ? Math.round((now - new Date(log[log.length - 1].t).getTime()) / 1000)
      : Infinity;
    if (navType === "reload" && lastCrumbAgeS > 10) {
      console.warn(
        "[Hub diag] The page RELOADED but NO recent in-app reload was recorded. " +
          "The cause is EXTERNAL to app code — likely the service worker, the " +
          "browser/kiosk shell, or a meta refresh."
      );
    }
  } catch {
    /* ignore */
  }
}
