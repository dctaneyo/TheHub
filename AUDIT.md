# The Hub — Comprehensive Codebase Audit

**Date:** 2026-03-20
**Stack:** Next.js 16.1.6, React 19, SQLite (better-sqlite3), Drizzle ORM, Socket.io, LiveKit, Sentry, PWA
**Deployment:** Railway (custom Node server)

---

## 1. Architecture Overview

- **~97 API routes** under `src/app/api/`
- **40+ DB tables** (SQLite via Drizzle ORM)
- **Multi-tenant** architecture: subdomain-based routing (`{slug}.meetthehub.com`)
- **Real-time:** Socket.io for messaging, task notifications, mirror mode, broadcasts
- **Video:** LiveKit for meetings and broadcasts
- **Auth:** JWT in httpOnly cookie, 4-digit PIN login, session management
- **Custom server** (`server.ts`): cron jobs (backups, cleanup, reports), Socket.io init, task scheduler

---

## 2. What's Already Been Fixed (Previous Sessions)

- ✅ Removed unused packages
- ✅ Migrated all ~97 API routes to `getAuthSession()` (tenant-aware)
- ✅ Standardized API responses: `apiSuccess()` (flat spread), `ApiErrors.*` helpers
- ✅ CSP nonce implementation (per-request nonce in middleware, `strict-dynamic`)
- ✅ CSRF protection via `x-hub-request: 1` header
- ✅ Security headers in `next.config.ts` (HSTS, X-Frame-Options, etc.)
- ✅ Session rotation on login
- ✅ Silent catch fixes (added logging where needed)
- ✅ ARL page refactor: monolithic 1100-line page → 15 nested route segments + shared layout
- ✅ Meeting room component extraction (controls bar, participant panel, Q&A panel)
- ✅ React Error #31 fix (error objects rendered as React children)
- ✅ Tenant settings admin check fix (`session.role` instead of broken DB lookup)
- ✅ Notification improvements: auto-dismiss >2 days, due-soon→overdue upgrade, preferences wired up
- ✅ Zod validation on key mutation routes (login, ARLs, locations, roles, emergency, reports, etc.)
- ✅ Rate limiting on login and user validation endpoints

---

## 3. Security Issues

### 3.1 HIGH — Tenant Isolation Gaps in Form Routes

**Files:** `src/app/api/forms/download/route.ts`, `src/app/api/forms/email/route.ts`, `src/app/api/forms/email-self/route.ts`

These routes fetch forms by `id` alone without filtering by `tenantId`. An authenticated user from Tenant A could download or email a form belonging to Tenant B if they know the UUID.

**Fix:** Add `and(eq(schema.forms.id, id), eq(schema.forms.tenantId, session.tenantId))` to all form lookups.

### 3.2 HIGH — Session Activate/Force Routes Missing Tenant Scoping

**Files:** `src/app/api/session/activate/route.ts`, `src/app/api/session/force/route.ts`

When looking up locations/ARLs by ID during session activation, there's no `tenantId` filter. A malicious ARL could potentially activate a session for a user in a different tenant.

**Fix:** Add `tenantId` to all `locations`/`arls` lookups in these routes.

### 3.3 MEDIUM — No Rate Limiting on Sensitive Mutation Routes

Rate limiting exists only on `/api/auth/login` and `/api/auth/validate-user`. Missing from:
- `/api/auth/force-apply` (remote login)
- `/api/session/activate` (session activation)
- `/api/emergency` POST (emergency broadcasts)
- `/api/data-management/*` (destructive operations)
- `/api/tenants/signup` (tenant registration)

### 3.4 MEDIUM — No Audit Logging for Destructive Operations

The `audit-logger.ts` module exists but is only imported in `bulk-tasks/route.ts`. No audit trail for:
- User creation/deletion
- Tenant settings changes
- Data purge operations (`/api/data-management/*`)
- Emergency broadcasts
- Role/permission changes

### 3.5 LOW — Meeting Analytics Route Missing Tenant Filter

**File:** `src/app/api/meetings/analytics/route.ts`

Fetches meeting analytics by `id` or `meetingId` without `tenantId` filter.

### 3.6 LOW — Message Read/Reaction Routes Missing Ownership Check

**Files:** `src/app/api/messages/read/route.ts`, `src/app/api/messages/reaction/route.ts`

Messages are fetched by ID without verifying the caller is a participant in the conversation.

---

## 4. Code Quality & Architecture

### 4.1 HIGH — Duplicated Task Recurrence Logic (4 copies)

The "does this task apply to today?" logic (daily/weekly/biweekly/monthly recurrence) is duplicated in:
1. `src/lib/socket-handlers/tasks.ts` — `taskAppliesToToday()` (canonical)
2. `src/app/api/leaderboard/route.ts` — inline `taskAppliesToday()`
3. `src/app/api/gamification/route.ts` — inline `taskAppliesToday()`
4. `src/app/api/tasks/today/route.ts` — inline `taskAppliesToday()`
5. `src/app/api/tasks/upcoming/route.ts` — inline `taskAppliesToday()`

**Fix:** Extract to a shared `src/lib/task-utils.ts` and import everywhere.

### 4.2 HIGH — Oversized Components

| File | Lines | Notes |
|------|-------|-------|
| `src/components/meeting-room/meeting-room-livekit-custom.tsx` | ~1501 | Largest component. Could extract settings panel, recording controls, layout switcher. |
| `src/app/dashboard/page.tsx` | ~1393 | Location dashboard. Extract timeline, header, task completion logic into sub-components. |
| `src/components/restaurant-chat.tsx` | ~1112 | Chat UI. Extract message list, input bar, attachment handling. |
| `src/components/remote-viewer.tsx` | ~846 | Mirror mode viewer. |
| `src/app/meeting/page.tsx` | ~837 | Meeting join page. |

### 4.3 MEDIUM — N+1 Query in Locations Route

**File:** `src/app/api/locations/route.ts`

The DELETE handler fetches all conversations with `.all()` then filters in JS, then loops through each to delete messages one by one. Should use SQL `WHERE IN` or batch deletes.

The GET handler also fetches all locations then does per-location session lookups in a loop.

### 4.4 MEDIUM — JSON Columns Parsed Everywhere

Fields like `recurringDays`, `features`, `viewedBy`, `targetLocationIds`, `deletedBy`, `permissions`, `assignedLocationIds` are stored as JSON strings and parsed with `JSON.parse()` at every read site. Consider:
- Adding Drizzle custom column types that auto-serialize/deserialize
- Or at minimum, shared parse helpers with error handling

### 4.5 LOW — Unused Imports

`src/app/api/forms/email/route.ts` imports `NextResponse` but never uses it.

---

## 5. Performance

### 5.1 MEDIUM — No Caching for Frequently Accessed Data

- Tenant settings are fetched from DB on every request (could cache in-memory with short TTL)
- Leaderboard calculations re-query all tasks + completions on every page load
- Location list with online status does per-location session lookups

### 5.2 MEDIUM — Task Notification Timers Are Per-Location

`scheduleTaskNotifications()` creates individual `setTimeout` timers for every task × every location. With 50 locations × 20 tasks = 1000 timers. Consider a single interval that checks all due tasks.

### 5.3 LOW — No Database Indexes Defined in Schema

The Drizzle schema has no explicit indexes. Queries filtering by `tenantId`, `userId`, `locationId`, `conversationId`, `createdAt` would benefit from composite indexes. There's a `scripts/add-indexes.ts` script but it's unclear if it's been run in production.

---

## 6. Testing

### 6.1 Critical Gap — ~5% Test Coverage

Only **4 test files** + 1 e2e spec:
- `src/lib/permissions.test.ts` (~20 tests)
- `src/lib/api-response.test.ts` (~15 tests)
- `src/lib/auth.test.ts` (~10 tests)
- `src/app/api/achievements/route.test.ts` (~6 tests)
- `e2e/auth.spec.ts` (Playwright)

**Priority test targets:**
1. Task recurrence logic (complex date math, biweekly edge cases)
2. Auth middleware (tenant routing, CSRF, JWT validation)
3. Notification system (preferences, auto-dismiss, upgrade logic)
4. Session management (activate, force, expiry)
5. Data management routes (destructive operations need safety tests)

---

## 7. Reliability

### 7.1 MEDIUM — Cron Jobs Have No Retry/Alerting

`server.ts` cron jobs (backup, cleanup, reports) catch errors and log them but have no retry mechanism or external alerting. A failed backup goes unnoticed.

### 7.2 MEDIUM — Socket.io Reconnection Edge Cases

Task notification timers are scheduled on socket connect and cancelled on disconnect. If a location briefly disconnects and reconnects, timers are rescheduled but any that fired during the gap are lost.

### 7.3 LOW — In-Memory Rate Limiter

`src/lib/rate-limiter.ts` uses an in-memory `Map`. This resets on every deployment and doesn't work across multiple server instances (though currently single-instance on Railway).

---

## 8. Dead Code & Cleanup Candidates

| File/Module | Status | Notes |
|-------------|--------|-------|
| `src/lib/audit-logger.ts` | Mostly unused | Only imported in `bulk-tasks/route.ts`. Either wire up everywhere or remove. |
| `scripts/migrate-to-turso.ts` | Obsolete | Turso migration was abandoned (using better-sqlite3). |
| `scripts/migrate-to-4digit.js` | Obsolete | One-time migration script. |
| `scripts/cleanup-duplicate-conversations.js` | Obsolete | One-time cleanup. |
| `scripts/reset-pins.js` | Obsolete | One-time script. |
| `scripts/railway-migration.js` | Obsolete | One-time Railway setup. |
| `drizzle/0000_left_energizer.sql` | Historical | Old migration files, kept for reference. |

---

## 9. Accessibility

### 9.1 MEDIUM — Missing ARIA Labels

- Notification bell has `aria-label` ✅
- Most interactive elements in dashboard, chat, and meeting components lack `aria-label`, `role`, or `aria-live` attributes
- Modal dialogs (overdue overlay, notification panel) don't trap focus
- No skip-to-content link

### 9.2 LOW — Color Contrast

- The `--hub-red` primary color on white backgrounds may not meet WCAG AA contrast ratios
- Dark mode support exists but hasn't been audited for contrast

---

## 10. Recommended Priority Order

### Immediate (Security) — ✅ ALL DONE
1. ✅ Fix tenant isolation in form download/email/email-self routes
2. ✅ Fix tenant isolation in session activate/force routes
3. ✅ Fix tenant isolation in meeting analytics route

### Short-Term (Quality) — ✅ ALL DONE
4. ✅ Extract shared `taskAppliesToday()` to eliminate 4 copies → `src/lib/task-utils.ts`
5. ✅ Add rate limiting to sensitive mutation routes (session/activate, session/force, tenants/signup, emergency)
6. ✅ Wire up audit logging for all destructive operations (16 routes)
7. Add tests for task recurrence logic and notification system

### Medium-Term (Architecture) — MOSTLY DONE
8. Break down oversized components (dashboard, chat, meeting room)
9. ✅ Add database indexes for common query patterns (auto-applied on server startup)
10. ✅ Add in-memory caching for tenant settings (60s TTL with invalidation)
11. ✅ Replace N+1 queries with batch operations (locations GET + user/location DELETE)

### Long-Term (Polish)
12. Accessibility audit and ARIA improvements
13. Increase test coverage to >30%
14. Add cron job monitoring/alerting
15. Consider moving rate limiter to Redis if scaling beyond single instance
