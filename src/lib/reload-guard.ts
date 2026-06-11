// Cross-cutting guard so the build-update auto-reload never interrupts a
// destructive-to-lose action (e.g. an in-progress, unsaved grid layout edit).
//
// While blocked, any reload requested by the socket build:id watcher is held
// and replayed once the block is lifted (edit saved/cancelled). This keeps the
// kiosk auto-update behaviour while guaranteeing unsaved work isn't wiped.

let blocked = false;
let pendingReload: (() => void) | null = null;

export function setReloadBlocked(value: boolean): void {
  blocked = value;
  if (!value && pendingReload) {
    const fn = pendingReload;
    pendingReload = null;
    fn();
  }
}

export function isReloadBlocked(): boolean {
  return blocked;
}

/** Register a reload to run as soon as the block is lifted. */
export function deferReload(fn: () => void): void {
  pendingReload = fn;
}
