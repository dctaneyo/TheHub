// Reload diagnostics — survives the console clear that a full reload causes.
//
// Every in-app navigation/reload calls recordReload(reason) right before it
// happens. Visibility changes are logged via recordEvent so we can tell when a
// reload was preceded by the tab being backgrounded (a strong signal that the
// browser — e.g. Safari discarding a background tab — caused the reload, not us).
//
// On the next load, logStartupDiagnostics() prints:
//   - the browser's navigation type (reload | navigate | back_forward),
//   - seconds since the previous load (reveals a recurring cadence),
//   - the recent breadcrumb trail, and
//   - a best-guess attribution (in-app reload vs external/browser).

const KEY = "hub-reload-log";
const MAX = 16;

type Kind = "reload" | "event";

interface Breadcrumb {
  t: string;
  kind: Kind;
  reason: string;
}

function append(kind: Kind, reason: string): void {
  if (typeof window === "undefined") return;
  try {
    const log: Breadcrumb[] = JSON.parse(localStorage.getItem(KEY) || "[]");
    log.push({ t: new Date().toISOString(), kind, reason });
    while (log.length > MAX) log.shift();
    localStorage.setItem(KEY, JSON.stringify(log));
  } catch {
    /* ignore storage failures */
  }
}

/** Record an imminent in-app full reload / navigation. */
export function recordReload(reason: string): void {
  append("reload", reason);
}

/** Record a non-reload signal (e.g. tab hidden/visible). */
export function recordEvent(reason: string): void {
  append("event", reason);
}

export function logStartupDiagnostics(): void {
  if (typeof window === "undefined") return;
  try {
    let navType = "unknown";
    const navs = performance.getEntriesByType(
      "navigation"
    ) as PerformanceNavigationTiming[];
    if (navs[0]?.type) navType = navs[0].type;

    const now = Date.now();
    const LOAD_KEY = "hub-last-load-ts";
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
      console.log("[Hub diag] recent breadcrumbs:", log);
    }

    const lastReload = [...log].reverse().find((b) => b.kind === "reload");
    const lastReloadAgeS = lastReload
      ? Math.round((now - new Date(lastReload.t).getTime()) / 1000)
      : Infinity;
    const lastEntry = log[log.length - 1];
    const lastWasHidden = lastEntry?.reason === "tab hidden";

    if (lastReloadAgeS <= 10) {
      console.log(
        `[Hub diag] → attributed to IN-APP reload: "${lastReload!.reason}" (${lastReloadAgeS}s ago)`
      );
    } else if (navType === "reload") {
      if (lastWasHidden) {
        console.warn(
          "[Hub diag] → The tab was BACKGROUNDED just before this reload and no " +
            "in-app reload was recorded. This is almost certainly the browser " +
            "discarding/reloading a background tab (e.g. Safari memory management), " +
            "not the app."
        );
      } else {
        console.warn(
          "[Hub diag] → The page reloaded with NO in-app reload recorded. The " +
            "cause is EXTERNAL to app code (service worker, browser, or kiosk shell)."
        );
      }
    }
  } catch {
    /* ignore */
  }
}
