# The Hub — Comprehensive Codebase Audit

**Date:** 2026-06-28 (re-audit; supersedes 2026-03-20)
**Stack:** Next.js 16.1.6, React 19.2.3, SQLite (better-sqlite3 12.6.2), Drizzle ORM 0.45.1, Socket.io 4.8.3, LiveKit (client 2.17.2 / server-sdk 2.15.0), Sentry 10.40, Ark UI 5.37, PWA
**Deployment:** Railway (custom Node server)

**This is a full re-run, not an edit of the 2026-03-20 version.** That
document was over three months old and had drifted in several ways: stale
file paths (some named files had moved or been renamed), wrong line counts,
and findings the body text described as "open" that the document's own
priority checklist already marked done. Treat any earlier version of this
file as historical only — every claim below was re-verified against current
code.

---

## 1. Architecture Overview

- **98 API routes** under `src/app/api/` (verified via file count). The old
  "~97" is still accurate.
- **33 DB tables** in `src/lib/db/schema.ts` (verified count of
  `= sqliteTable(`). The old "40+" was an overcount — current ground truth
  is **33**.
- **Multi-tenant**: subdomain-based routing confirmed in `src/middleware.ts`
  (per-request nonce, tenant resolution).
- **Real-time**: Socket.io confirmed (`src/lib/socket-server.ts`,
  `socket-context.tsx`, `socket-handlers/`).
- **Video**: LiveKit confirmed.
- **Auth**: JWT in httpOnly cookie + 4-digit PIN; session management via
  `getSession()`/`getAuthSession()`.
- **Custom server** (`server.ts`, 110 lines): node-cron jobs (daily/weekly/
  monthly backups, daily cleanup, hourly scheduled reports), Socket.io
  init, task notification scheduler.
- **Materially changed since last audit:** The **gamification / leaderboard
  / achievements** feature has been **removed entirely** —
  `src/app/api/leaderboard/route.ts`, `gamification/route.ts`, and
  `achievements/route.ts` (and its test) no longer exist. Remaining string
  matches are cosmetic (landing page copy, admin page). This invalidates
  several old findings that referenced those routes.

---

## 2. What's Already Been Fixed (Verified This Pass)

Confirmed resolved against current code:

- ✅ **Tenant isolation in all three form routes.** `forms/download`
  (line 20), `forms/email` (line 30), `forms/email-self` (line 30) all now
  filter `and(eq(forms.id, …), eq(forms.tenantId, session.tenantId))`.
  (`email-self` line 40/44 looks up the caller's own location/ARL by
  `session.id`, which is correct.)
- ✅ **Tenant isolation in `session/activate` and `session/force`.**
  Location/ARL lookups during assignment filter by `tenantId` (activate
  lines 62/94; force lines 135/153).
- ✅ **Tenant isolation in `meetings/analytics`.** Both GET (lines 22–23)
  and DELETE (lines 96/104) scope every query by
  `meetingAnalytics.tenantId`.
- ✅ **Message ownership checks added.** `messages/read` verifies direct-
  conversation participants and group `conversationMembers` (lines 31–47);
  `messages/reaction` does the same and returns `forbidden` for
  non-participants (lines 26–37).
- ✅ **Task-recurrence logic extracted** to `src/lib/task-utils.ts`
  (`taskAppliesToDate`, `startOfWeekMonday`), imported by `tasks/today`,
  `tasks/upcoming`, `socket-handlers/tasks.ts`,
  `task-notification-scheduler.ts`. No inline `taskAppliesToToday` copies
  remain.
- ✅ **N+1 in `locations` DELETE replaced with batch SQL** —
  `DELETE … WHERE … IN (SELECT …)` subqueries for
  message_reads/messages/conversation_members/conversations (lines
  ~250–290), no per-row JS loop for conversation deletion.
- ✅ **DB indexes auto-applied at startup** in `src/lib/db/index.ts` (lines
  224–314): composite indexes on messages, task_completions, notifications,
  sessions, message_reads, plus a per-table `idx_<table>_tenant` loop (line
  290). The old `scripts/add-indexes.ts` logic was inlined here.
- ✅ **In-memory tenant cache** in `src/lib/tenant.ts` (60s TTL,
  `tenantCache` Map line 29, `invalidateTenantCache()` line 61).
- ✅ **CSP nonce + CSRF** present in `src/middleware.ts` (per-request nonce
  line 133, `x-hub-request: 1` enforcement returns 403 at lines 150–154).
- ✅ **Rate limiting added** to `session/activate`, `session/force`,
  `emergency` POST, `tenants/signup` (and `meetings/lookup`,
  `meetings/invite`, `auth/reset-lockout`, `auth/resolve-org`,
  `auth/resolve-org-by-ip` beyond the originally-requested set).
- ✅ **Skip-to-content link** added (`src/app/layout.tsx` line 101,
  `#main-content`).
- ✅ **Ark UI primitives** (`ui/dialog.tsx`, `ui/select.tsx`, `ui/menu.tsx`)
  backed by `@ark-ui/react` with real focus management; `IconTip`
  component (`ui/icon-tip.tsx`) for touch-compatible labels.

---

## 3. Security Issues

### 3.1 ~~CRITICAL (NEW) — Unauthenticated cross-tenant mutation endpoints~~ — **Fixed 2026-06-28**

**Files (deleted):** `src/app/api/migrate-users/route.ts`,
`src/app/api/admin/migrate-4digit/route.ts`

`migrate-users` POST had **zero authentication** (confirmed: no session, no
admin secret, no token check) and rewrote `userId` for **all ARL users and
locations across every tenant** via raw `sqlite.prepare(... UPDATE ...)`.
The comment even said "Simple migration endpoint - DELETE AFTER USE" — it
was never deleted. `admin/migrate-4digit` had the identical logic and the
same missing auth check — the two routes were near-duplicates of each
other. Both were one-time historical migrations from when user IDs were
longer than 4 digits; the app has used 4-digit IDs exclusively for a long
time, confirmed via the extensive ARL work in the same session, so the
migration these routes performed is long since complete. Verified no other
code, scripts, or docs called either route before removing them. Both
files (and the now-empty `migrate-users/` and `admin/migrate-4digit/`
directories) were deleted outright rather than auth-gated, since they had
no remaining purpose.

### 3.2 ~~MEDIUM — `auth/force-apply` still missing rate limiting~~ — **Fixed 2026-06-28**

**File:** `src/app/api/auth/force-apply/route.ts`

Added the same `checkRateLimit`/`getClientIP` pattern already used in
`session/activate` (20 attempts/60s, 2min lockout) to both `GET` and
`POST` handlers, keyed `force-apply:${ip}`. It still uses `verifyToken`
directly rather than `getAuthSession()` — that's correct, not a gap: this
route's whole job is to verify a token *before* a session exists (it's how
the token becomes the session cookie), so it can't depend on
`getAuthSession()` the way protected routes do.

### 3.3 ~~LOW — `data-management/*` routes have no rate limiting~~ — **Fixed 2026-06-28**

Added `checkRateLimit`/`getClientIP` to all 12 destructive POST handlers
(`archive-old-data`, `bulk-tasks`, `clear-sessions`, `drop-tables`,
`duplicate-check`, `orphaned-cleanup`, `purge-broadcast-data`,
`purge-conversations`, `purge-messages`, `purge-notifications`,
`purge-old-tasks`, `vacuum`), keyed by a single shared
`data-management:${ip}` bucket (10 attempts/60s, 5min lockout) rather than
one bucket per route — these are all gated behind the same
`DATA_MANAGEMENT_ACCESS` permission, so a per-route limit would let an
attacker just round-robin across routes to bypass it. The six read-only
GET handlers (`audit-log`, `export`, `integrity-check`, `system-report`,
`usage-analytics`, plus `duplicate-check`'s own GET) were deliberately
left alone — they don't mutate data, so the original concern (un-throttled
destructive operations) doesn't apply to them.

### 3.3a ~~CRITICAL (NEW) — `data-management/*` deletes had zero tenant scoping~~ — **Fixed 2026-06-28**

Found while writing safety tests for these routes, not by the original
2026-03-20 audit. Every one of the 10 destructive purge/cleanup/bulk
routes (`archive-old-data`, `bulk-tasks`, `clear-sessions`,
`duplicate-check`, `purge-broadcast-data`, `purge-conversations`,
`purge-messages`, `purge-notifications`, `purge-old-tasks`) deleted data
**across every tenant at once** — `tenantId` only ever appeared in the
audit-log call (recording *who* ran the operation), never in a `WHERE`
clause. Any tenant admin with `DATA_MANAGEMENT_ACCESS` (an ordinary
permission, not a platform-superadmin one) could wipe out every other
tenant's messages, conversations, broadcasts, notifications, and sessions
in one click. This is more severe than the unauthenticated migration
endpoints in §3.1 — it required only a normal authenticated session, not
zero auth.

`bulk-tasks`'s `create-tasks-bulk` action had a second, distinct bug: the
`INSERT INTO tasks` statement never set `tenant_id` at all, so every
bulk-created task silently fell back to the column's default (`'kazi'`)
regardless of which tenant's admin created it — a data-integrity bug, not
just an authorization gap.

Fixed by adding `WHERE tenant_id = ?` (or the appropriate join/subquery
for tables without their own `tenantId`, e.g. `messages` scoped via
`conversation_id IN (SELECT id FROM conversations WHERE tenant_id = ?)`,
`sessions` scoped via the `locations`/`arls` row the session's `user_id`
points at) to every query in all 9 affected routes, and adding
`tenant_id` to `bulk-tasks`'s task INSERT.

`drop-tables` and `vacuum` needed no change — `drop-tables` operates on
unused onboarding tables via an allowlist (not tenant data), and `vacuum`
is whole-database-file maintenance, not row deletion. `orphaned-cleanup`
was deliberately left global too, for a different reason: every row it
deletes has already lost its parent record, so there's no tenant left to
attribute it to or restrict the cleanup to.

Added a tenant-scoping regression test for `purge-messages` (asserts
every prepared SQL statement contains a `tenant_id = ?` filter) alongside
the new safety tests in priority item 6 below.

### 3.4 RESOLVED — Audit logging coverage

The original "only `bulk-tasks`" claim and the later "16 routes" note:
current ground truth is **16 files** importing `audit-logger`. Verified
list: `arls` (create/delete), `roles` (create/update/delete),
`tenants/settings` (update), `emergency` (send/clear), `locations`
(delete), `session/force` (force_logout/force_reassign), and all 10
`data-management/*` routes (purge-notifications, archive-old-data,
purge-conversations, purge-old-tasks, clear-sessions, purge-broadcast-data,
orphaned-cleanup, purge-messages, drop-tables, bulk-tasks). The
originally-listed gaps (user create/delete, tenant settings, data purge,
emergency, role changes) are **all now covered**. Note: `audit-logger.ts`
writes to an `audit_log` SQLite table (self-healing schema check) and
degrades non-fatally on error. Status: **resolved.**

### 3.5 RESOLVED — Form, session, meeting-analytics tenant isolation; message ownership

All resolved — see §2. The original §3.1, §3.2, §3.5, §3.6 findings (in the
2026-03-20 version) are no longer open.

### Notes on auth-helper coverage

A scan for routes not referencing `getAuthSession`/`verifyToken`/
`requireAuth` surfaces the expected public/auth-flow endpoints (health,
login, validate-user, resolve-org, session ping/heartbeat/pending,
meetings join/lookup/invite, admin/* which use a separate `ADMIN_SECRET`
cookie). `session/activate` and `session/force` use `getSession()` (not
`getAuthSession`) but do correctly carry `session.tenantId` through their
queries. The only genuinely concerning unauthenticated routes are the two
migration endpoints in §3.1.

---

## 4. Code Quality & Architecture

### 4.1 RESOLVED — Duplicated task-recurrence logic

Extracted to `src/lib/task-utils.ts` and imported everywhere it's needed
(see §2). The two routes the original cited as duplicating it
(`leaderboard`, `gamification`) no longer exist. Status: **resolved.**

### 4.2 STILL OPEN (paths changed) — Oversized components

Fresh `wc -l` across `src/components` and `src/app` (largest files):

| File | Lines | Note vs. old audit |
|------|-------|--------------------|
| `src/components/meeting-room-livekit-custom.tsx` | 1515 | Moved out of `meeting-room/` subdir; was cited ~1501. Still the largest. |
| `src/app/login/page.tsx` | 1271 | **Not in old audit** — now the 2nd largest. |
| `src/components/dashboard/restaurant-chat.tsx` | 1170 | Moved into `dashboard/`; was cited ~1112. |
| `src/app/meeting/page.tsx` | 983 | Grew from cited ~837. |
| `src/components/arl/user-management.tsx` | 924 | **Not in old audit.** |
| `src/components/keyboard/onscreen-keyboard.tsx` | 819 | **Not in old audit.** |
| `src/app/dashboard/page.tsx` | 778 | **Shrank** from cited ~1393 (already partially decomposed). |
| `src/components/arl/scheduled-meetings.tsx` | 672 | New entrant. |

`remote-viewer.tsx` moved to `src/components/arl/remote-viewer.tsx` and
shrank to 496. Status: **still open; the old file list/paths were stale —
use the table above.**

### 4.3 PARTIALLY RESOLVED — N+1 in `locations` route

DELETE handler's conversation cleanup is now batch SQL (resolved — see
§2). The **GET handler still loops** — it fetches all locations and all
ARLs then `.map()`s per-row online-status lookups against an in-memory
session set (lines 24–77, 150–151). This is now O(n) in JS over a
pre-fetched set rather than per-row DB queries, so it's much better than a
true N+1, but still a JS-side loop. Status: **DELETE resolved; GET
acceptable but not fully batched.**

### 4.4 STILL OPEN — JSON columns parsed everywhere

**64 `JSON.parse()` occurrences across 30 files.** No shared parse helper
or Drizzle custom column type was introduced (no `src/lib/json*.ts`, no
`customType`/`safeJsonParse` helper found). Status: **still open as
described.**

### 4.5 — Unused-import nit

The original `NextResponse` unused-import claim in `forms/email/route.ts`
is unverified/likely stale (file was rewritten for tenant scoping). Low
value; not re-confirmed.

---

## 5. Performance

### 5.1 PARTIALLY RESOLVED — Caching

Tenant settings: **resolved** via 60s in-memory cache with invalidation
(`src/lib/tenant.ts`). Leaderboard caching: **moot** (feature removed).
Location-list online-status: still a per-request in-memory loop (see §4.3)
but no longer per-row DB hits. Status: **mostly resolved.**

### 5.2 STILL OPEN — Per-task × per-location `setTimeout` timers

`src/lib/task-notification-scheduler.ts` (303 lines) still creates
individual `setTimeout` timers per location × per due task — two timers
each (`due-soon` and `overdue`), keyed
`${location.id}:${task.id}:due-soon` (lines 186–220), stored in a
`_timers` Map. Architecture is unchanged from the original finding; it has
been improved only insofar as it now resolves per-location timezones and
has a midnight re-schedule timer. Status: **still open as described.**

### 5.3 RESOLVED — Database indexes

Indexes are now defined and auto-applied at startup in
`src/lib/db/index.ts` (see §2). Note: they are created via raw
`CREATE INDEX IF NOT EXISTS` rather than declared in the Drizzle schema
(schema.ts still has 0 `index()` declarations), but they are applied in
production on boot. Status: **resolved (via runtime DDL, not schema
declarations).**

---

## 6. Testing

Fresh count: **8 unit/integration test files** + **1 e2e spec** (up from
the cited 4 + 1):
- `src/lib/permissions.test.ts`
- `src/lib/api-response.test.ts`
- `src/lib/auth.test.ts`
- `src/middleware.test.ts` (NEW)
- `src/app/api/admin/ip-mappings/route.test.ts` (NEW)
- `src/app/api/admin/ip-mappings/[id]/route.test.ts` (NEW)
- `src/app/api/auth/resolve-org/route.test.ts` (NEW)
- `src/app/api/auth/resolve-org-by-ip/route.test.ts` (NEW)
- `e2e/auth.spec.ts` (Playwright)

The old `achievements/route.test.ts` is gone (route removed). Coverage
breadth improved (middleware, IP-mapping admin routes, org resolution now
tested) but the high-value targets remain untested: **task recurrence
(`task-utils.ts`), notification scheduler, session activate/force,
data-management destructive routes.** Status: **improved but still low;
core business logic largely untested.**

---

## 7. Reliability

### 7.1 STILL OPEN — Cron jobs have no retry/alerting

`server.ts` (lines 46–88) wraps each cron job (backup ×3, cleanup, hourly
reports) in try/catch that only `console.error`s. **No Sentry capture, no
retry, no external alert** (confirmed: zero `Sentry`/`captureException`/
`retry`/`notify` matches in server.ts). A failed nightly backup is silent.
Status: **still open as described.**

### 7.2 PARTIALLY ADDRESSED — Socket.io reconnection

`src/lib/socket-context.tsx` configures `reconnection: true`,
`reconnectionAttempts: Infinity`, delay 1000ms / max 5000ms (lines 65–72),
and handles `connect`/`disconnect`/`connect_error` with an
instance-settle timer (lines 76–174). Client reconnection is robust.
However, the underlying concern remains: server-side task-notification
timers fired during a disconnect gap are still lost (the scheduler
reschedules on reconnect but does not replay missed fires). Status:
**client reconnection solid; missed-fire-during-gap still open.**

### 7.3 STILL OPEN — In-memory rate limiter

`src/lib/rate-limiter.ts` uses a process-global in-memory `Map`
(`globalThis.__hubRateLimitStore`, lines 16–18). Resets on deploy,
single-instance only. Status: **still open as described.**

---

## 8. Dead Code & Cleanup Candidates

| File/Module | Current Status |
|-------------|----------------|
| `src/lib/audit-logger.ts` | **No longer dead** — imported by 16 routes. Keep. |
| `scripts/migrate-to-turso.ts` | **Deleted 2026-06-29** — Turso migration was abandoned. |
| `scripts/migrate-to-4digit.js` | **Deleted 2026-06-29** — pointed at a stale `data/database.sqlite` path that doesn't match the app's actual DB path; the migration itself is long since complete (confirmed via the corresponding API endpoints, deleted §3.1). |
| `scripts/cleanup-duplicate-conversations.js` | **Deleted 2026-06-29** — targeted `drizzle-orm/postgres-js`, a Postgres setup this app never runs (SQLite via better-sqlite3 throughout). |
| `scripts/reset-pins.js` | **Deleted 2026-06-29** — superseded by the in-app admin "Reset PIN" feature in `user-management.tsx`. |
| `scripts/railway-migration.js` | **Deleted 2026-06-29** — a manual-console-run duplicate of the same 4-digit migration as the deleted `migrate-users`/`admin/migrate-4digit` API routes (§3.1). |
| `scripts/add-indexes.ts` | **Deleted 2026-06-29** — confirmed every index it created already exists (and more) in the auto-applied migrations in `src/lib/db/index.ts`; also removed the now-pointless `db:add-indexes` script entry from `package.json`. |
| `src/app/api/migrate-users/route.ts` | **Deleted 2026-06-28** — see §3.1. |
| `src/app/api/admin/migrate-4digit/route.ts` | **Deleted 2026-06-28** — see §3.1. |

All six obsolete scripts are now removed. Status: **resolved.**

---

## 9. Accessibility

### 9.1 IMPROVED — Primitives, labels, focus, skip link

- **Skip-to-content link**: now present (`src/app/layout.tsx:101`).
  Status: **resolved.**
- **Focus trap on modals**: Ark-UI-backed `ui/dialog.tsx`
  (`@ark-ui/react/dialog` + Portal) provides real focus management.
  Adopted by ~11 ARL components (arl-calendar, group-info-modal, messaging,
  notification-tester, scheduled-meetings, task-form-modal, task-manager,
  task-virtual-list, tenant-settings, user-management, plus arl/layout).
  Status: **substantially improved for the ARL surface.**
- **Touch-compatible labels**: `IconTip` (`ui/icon-tip.tsx`) now wraps
  title-only icon controls; recent commits added it across
  forms-repository, locations-manager, messaging, user-management,
  scheduled-meetings, swipeable-convo-row.
- **Remaining gap**: ~8 components under `src/components/arl/` still use
  raw `fixed inset-0 z-[…]` overlay modals rather than the Ark `Dialog`
  primitive, so focus-trap coverage is **partial, concentrated on the ARL
  console**. The dashboard/chat/meeting surfaces have not been
  systematically migrated — see CODE-STYLE-AUDIT.md §2c and APP-AUDIT.md
  Finding 3 for the broader cross-app picture. Status: **(c) improved, but
  coverage is partial — mostly ARL, not the operator/location-facing
  dashboard.**

### 9.2 STILL OPEN — Color contrast

No contrast audit evidence found; `--hub-red` on white and dark-mode
contrast remain un-audited. Status: **still open as described.**

---

## 10. Recommended Priority Order

### Immediate (Security) — all done 2026-06-28

1. ~~**Delete `src/app/api/migrate-users/route.ts`**~~ — done.
2. ~~**Delete or auth-gate `src/app/api/admin/migrate-4digit/route.ts`.**~~ — done.
3. ~~Add rate limiting to `auth/force-apply` (remote-login apply).~~ — done.
4. ~~Add rate limiting to `data-management/*` purge/drop routes.~~ — done.
5. ~~**Add tenant scoping to all `data-management/*` deletes**~~ — done.
   See §3.3a — found while writing the safety tests below, more severe
   than items 1-2.

### Short-Term (Quality / Tests)

6. ~~Add tests for `task-utils.ts` recurrence math~~ — done (25 tests,
   `src/lib/task-utils.test.ts`). ~~`session/activate`/`force`~~ — done
   (13 + 19 tests). The notification scheduler
   (`task-notification-scheduler.ts`) remains untested — it manages
   `setTimeout` timer state directly rather than pure functions, so it
   needs a different testing approach (fake timers) than the other two.
7. ~~Add safety tests for `data-management/*` destructive routes.~~ —
   done for all 10 destructive routes (drop-tables, purge-messages,
   purge-notifications, purge-old-tasks, purge-broadcast-data,
   purge-conversations, clear-sessions, duplicate-check,
   archive-old-data, bulk-tasks — 110 tests total). Every one of the 9
   affected by §3.3a has a regression test asserting its queries carry
   the tenant-scoping filter; `drop-tables` has 6 tests specifically
   proving its table-name allowlist can't be bypassed (core table names,
   a SQL-injection-shaped string). Writing the first of these
   (`purge-messages`) is what surfaced §3.3a in the first place.
   `orphaned-cleanup` and `vacuum` weren't given dedicated test files —
   both are deliberately tenant-agnostic (see §3.3a) with no
   tenant-scoping property to regression-test, and their business logic
   is simple enough that the auth/permission/rate-limit gating they
   share with every other route is the only thing worth asserting,
   which the other 10 files already exercise as a pattern.

### Medium-Term (Architecture / Performance)

8. Break down oversized components — current top targets:
   `meeting-room-livekit-custom.tsx` (1515), `login/page.tsx` (1271),
   `restaurant-chat.tsx` (1170), `meeting/page.tsx` (983),
   `user-management.tsx` (924).
9. Replace per-task × per-location `setTimeout` timers with a single
   periodic sweep, and replay missed fires after socket reconnect gaps.
10. ~~Introduce a shared JSON-column helper~~ — done. Added
    `parseJsonColumn<T>(raw, fallback)` (`src/lib/json-column.ts`) and
    migrated every genuine DB-JSON-column call site — ~36 occurrences
    across 23 files (API routes, `lib/`, and the client components that
    parse the same fields after receiving them from those routes).
    Left alone, correctly: `lib/permissions.ts`'s two parsers (different
    validation semantics — `Array.isArray` checks, special empty-array
    handling — and already well-tested), `reload-diagnostics.ts` /
    `live-activity-feed.tsx` / `notification-bell.tsx` (localStorage
    serialization, not a DB column), and `data-management.tsx`'s
    `JSON.parse(text)` (a pure "is this valid JSON" validation check, no
    fallback semantics apply). Found and fixed two bonus issues along the
    way: `task-calendar.ts` and `arl-calendar.tsx` each had their own
    independent, undetected reimplementation of `task-utils.ts`'s
    recurrence logic — a third and fourth copy of exactly the duplication
    §4.1 already flagged once. Both now delegate to the canonical,
    tested `taskAppliesToDate()`. Also dropped two `(x as any).metadata`
    casts in `messaging.tsx`/`restaurant-chat.tsx` by adding the missing
    `metadata` field to both `Message` interfaces instead of casting
    around it.
11. Fully batch the `locations` GET online-status computation. — On
    review this is lower-value than it sounds: the GET handler already
    batch-fetches all online sessions once into an in-memory Map (see
    §4.3) and the "loop" is a JS `.map()` over that pre-fetched data, not
    a per-row DB query. The real N+1 problem is already gone; turning
    the remaining JS iteration into a single SQL JOIN would be cosmetic,
    not a performance fix. Deprioritized in favor of item 10.

### Long-Term (Polish / Ops)

12. Add Sentry capture + alerting (and ideally retry) to `server.ts` cron
    jobs.
13. Move rate limiter to a shared store (Redis) if scaling beyond single
    instance.
14. Complete accessibility migration: convert remaining raw
    `fixed inset-0` modals (ARL + dashboard/chat/meeting) to the Ark
    `Dialog` primitive; run a WCAG AA contrast audit on `--hub-red` and
    dark mode.
15. ~~Remove now-redundant `scripts/add-indexes.ts` and the obsolete
    one-time migration scripts~~ — done, see §8.

---

## Summary of drift corrected vs. the 2026-03-20 doc

- **Wrong counts:** DB tables 33 (not "40+"); test files 8+1 (not 4+1);
  dashboard page 778 (not 1393); meeting page 983 (not 837).
- **Stale paths:** `meeting-room-livekit-custom.tsx`, `restaurant-chat.tsx`,
  `remote-viewer.tsx` all moved.
- **Feature removed:** gamification/leaderboard/achievements — invalidated
  old §4.1 duplication detail, §3-era references, and §5.1 leaderboard
  caching.
- **Genuinely fixed since:** all form/session/analytics tenant isolation,
  message ownership, task-utils extraction, audit logging (16 routes), DB
  indexes, tenant cache, locations DELETE N+1, skip link, Ark UI focus
  primitives.
- **New issues found:** unauthenticated `migrate-users` /
  `admin/migrate-4digit` endpoints, and — found later the same day while
  writing safety tests, more severe than either — every
  `data-management/*` destructive route deleting data across every
  tenant at once with zero scoping (§3.3a). Both fixed.
- **Still open:** oversized components (deliberately left alone for now),
  per-task notification timers, cron alerting, in-memory rate limiter,
  color contrast, accessibility migration for the remaining raw
  `fixed inset-0` modals.
