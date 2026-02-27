# The Hub — Comprehensive Project Audit

**Audited by:** Claude Opus 4.6 (Thinking)
**Date:** February 27, 2026
**Scope:** Full codebase audit — architecture, features, backend, frontend, security, performance, UX, and recommendations

---

## Table of Contents

1. [Project Overview](#1-project-overview)
2. [Tech Stack Summary](#2-tech-stack-summary)
3. [Implemented Features Inventory](#3-implemented-features-inventory)
4. [Architecture Assessment](#4-architecture-assessment)
5. [Backend Improvements](#5-backend-improvements)
6. [Frontend Improvements](#6-frontend-improvements)
7. [Security Audit](#7-security-audit)
8. [Performance Audit](#8-performance-audit)
9. [Database & Data Layer](#9-database--data-layer)
10. [UX/UI Improvements](#10-uxui-improvements)
11. [New Feature Recommendations](#11-new-feature-recommendations)
12. [Dead Code & Technical Debt](#12-dead-code--technical-debt)
13. [Priority Roadmap](#13-priority-roadmap)

---

## 1. Project Overview

The Hub is a 24/7 touchscreen dashboard system for KFC franchise restaurants, deployed on Railway. It runs on mini PCs (Windows) in Chrome Kiosk mode at restaurant locations and is also accessed by Above Restaurant Leaders (ARLs) from computer/tablet/mobile devices.

**Two distinct user experiences:**
- **Restaurant Dashboard** — Fullscreen, no-scroll, touch-optimized kiosk for restaurant crew
- **ARL Hub** — Responsive multi-view management panel for leaders

**Core purpose:** Centralize task management, communication, gamification, and operational oversight for a franchise network.

---

## 2. Tech Stack Summary

| Layer | Technology | Version |
|---|---|---|
| **Framework** | Next.js | 16.1.6 |
| **Language** | TypeScript | 5.x |
| **React** | React | 19.2.3 |
| **Styling** | TailwindCSS | 4.x |
| **UI Library** | shadcn/ui + Radix UI | latest |
| **Animations** | Framer Motion | 12.34.1 |
| **Icons** | Lucide React | 0.574.0 |
| **Database** | SQLite via better-sqlite3 | 12.6.2 |
| **ORM** | Drizzle ORM | 0.45.1 |
| **Real-time** | Socket.io | 4.8.3 |
| **Video/Audio** | LiveKit | 2.17.2 |
| **Auth** | JWT (jsonwebtoken) | 9.0.3 |
| **Monitoring** | Sentry | 10.40.0 |
| **PWA** | next-pwa + Workbox | 5.6.0 / 7.4.0 |
| **Push Notifications** | web-push (VAPID) | 3.6.7 |
| **Charts** | Recharts | 3.7.0 |
| **Email** | SendGrid | 8.1.6 |
| **Scheduling** | node-cron | 4.2.1 |
| **Password Hashing** | bcryptjs | 3.0.3 |
| **Testing** | Vitest + Playwright + MSW | latest |
| **Deployment** | Railway | — |

**Custom server:** `server.ts` runs a plain Node HTTP server wrapping Next.js, with Socket.io attached to the same port. Cron jobs handle automated backups (daily/weekly/monthly).

---

## 3. Implemented Features Inventory

### 3.1 Authentication & Sessions
- **PinPad login** — 6-digit User ID + 6-digit PIN, iPadOS-style onscreen numpad
- **Two-step validation** — User ID validated first (shows name confirmation), then PIN
- **JWT cookie auth** — httpOnly cookie, middleware edge protection
- **Remote login** — ARL can activate a pending session on a kiosk via 6-digit code
- **Session tracking** — Real-time online/offline status, device type, current page
- **Force logout/redirect** — ARL can force-kick or redirect any session
- **Multi-session support** — Multiple kiosks per location

### 3.2 Restaurant Dashboard
- **Vertical timeline** — Today's tasks sorted by due time with completion buttons
- **Mini calendar** — Next 7 days of upcoming tasks
- **Completed/missed summary** — Today's completed + yesterday's missed tasks
- **Real-time clock** — Current time display
- **Idle screensaver** — Animated clock + color time tag system after inactivity
- **Task notifications** — Due-soon (30min) and overdue with fullscreen alarm overlay
- **Emergency overlay** — Fullscreen alert with repeating alarm sound
- **Restaurant chat** — Slide-out messaging panel with typing indicators
- **Gamification bar** — Points, streak, level, XP progress
- **Leaderboard** — Competitive ranking across locations
- **Forms viewer** — Browse and view uploaded PDFs
- **Live ticker** — Scrolling ARL-pushed messages
- **High-five animations** — Celebratory visual effects
- **Motivational quotes** — Random quotes display
- **Seasonal themes** — Holiday-themed decorations
- **Animated background** — Subtle particle/gradient effects
- **Connection status** — Server connection indicator with session info
- **Settings cog** — Sound toggle, screensaver delay, theme toggle
- **Color time tag system** — 9-color 30-minute cycle for food hold times

### 3.3 ARL Hub
- **14 management views** — overview, messages, tasks, calendar, locations, forms, emergency, users, leaderboard, remote-login, data-management, broadcast, meetings, analytics
- **Task manager** — Full CRUD for tasks/reminders with recurring schedule support (daily, weekly, biweekly, monthly)
- **Locations manager** — View/edit restaurant locations, online status
- **User management** — Create/edit ARLs and locations, reset PINs
- **Messaging** — Full chat with direct, group, and global conversations
- **Forms repository** — Upload/manage PDFs, email to locations
- **Emergency broadcast** — Send alerts to all or specific locations
- **Remote login** — Activate pending sessions on kiosks
- **Data management** — 16 maintenance operations (purge, vacuum, export, integrity check, etc.)
- **Broadcast studio** — Live stream to locations (LiveKit-based)
- **Scheduled meetings** — Create/manage video meetings with codes
- **Meeting analytics** — Detailed post-meeting analytics
- **Analytics dashboard** — Task completion trends, messaging stats, gamification metrics
- **Notification tester** — Test all notification types against specific locations
- **Ticker push** — Send scrolling messages to location dashboards
- **Swipe navigation** — Touch gesture support on mobile/tablet
- **Page indicator** — Visual dots showing current view position

### 3.4 Messaging System
- **Conversation types** — Direct (1:1), Group, Global (all users)
- **Real-time delivery** — WebSocket-based instant messaging
- **Read receipts** — Double-check marks for read messages
- **Typing indicators** — Shows who is typing
- **Voice messages** — Record and send audio messages
- **Message reactions** — Emoji reactions on messages
- **Emoji quick replies** — Preset emoji responses for fast kitchen communication
- **@Mentions** — Tag users in messages
- **Message search** — Search within conversations
- **Conversation muting** — Per-user notification suppression
- **Group management** — Create groups, add/remove members, admin roles
- **Soft-delete conversations** — Hide without deleting
- **Message purging** — Auto-purge messages older than 2 weeks
- **Push notifications** — Web push to ARLs when offline

### 3.5 Meeting System (LiveKit)
- **Video/audio meetings** — Full WebRTC via LiveKit
- **Meeting codes** — Short codes for easy joining
- **Guest access** — External participants can join via code
- **Meeting scheduling** — Create future meetings with descriptions
- **Host controls** — Mute participants, raise hand, screen share
- **Meeting analytics** — Participant tracking, duration, engagement metrics
- **Auto-end** — Meeting ends after host leaves (10-min grace period)
- **Join subdomain** — `join.meetthehub.com` routes to meeting page

### 3.6 Gamification
- **Points system** — Earn points for completing tasks
- **Streaks** — Consecutive days with all tasks completed
- **Levels** — XP-based leveling system
- **Achievements** — 29 achievements across 7 categories, 5 rarity tiers
- **Leaderboard** — Daily/weekly/monthly rankings
- **Celebrations** — Confetti, coin rain, fireworks on task completion
- **Sound effects** — Completion chimes, notification beeps

### 3.7 Notification System
- **Unified notification bell** — Single bell combining task alerts + DB notifications
- **Task alerts** — Due-soon and overdue with fullscreen overlay
- **DB notifications** — Shout-outs, high-fives, system updates
- **Notification categories** — 16 types (task_due_soon, new_message, high_five, etc.)
- **Priority levels** — Low, normal, high, urgent
- **Mark as read/delete** — Per-notification management
- **Cross-kiosk sync** — Dismiss on one kiosk, dismissed on all
- **Server-side scheduler** — 5-minute interval checking for due/overdue tasks

### 3.8 Social Features
- **High-fives** — Send celebratory high-fives between users
- **Shout-outs** — Public recognition messages
- **Social actions menu** — Quick access to social interactions
- **Live activity feed** — Real-time feed of completions, achievements, etc.

### 3.9 Infrastructure
- **Railway deployment** — Production hosting with automated builds
- **Automated backups** — Daily (2AM), weekly (Sunday 3AM), monthly (1st 4AM)
- **Database migrations** — Incremental ALTER TABLE migrations in `runMigrations()`
- **Sentry monitoring** — Error tracking for client, server, and edge
- **PWA support** — Service worker with Workbox caching strategies
- **Health endpoint** — `/api/health` for uptime monitoring
- **Build ID tracking** — Client/server build parity checks
- **Database indexes** — Script for adding performance indexes
- **Data export** — JSON export of all database tables

### 3.10 Other Features
- **Dark mode** — Theme toggle with system preference detection
- **Global search** — Search across tasks, conversations, locations
- **Onscreen keyboard** — iPadOS-inspired keyboard with emoji picker
- **Emoji picker** — Full emoji selector in messages
- **Sound management** — Per-location mute toggle, synced across kiosks
- **Voice announcements** — TTS for color time expiry warnings
- **GraphQL scaffolding** — Full schema + resolvers + Apollo Client (unused, kept for future)

---

## 4. Architecture Assessment

### 4.1 What's Working Well
- **Custom server pattern** — Single port for HTTP + WebSocket is clean and Railway-friendly
- **Socket rooms** — Well-organized room structure (`location:${id}`, `arl:${id}`, `conversation:${id}`)
- **Emit abstraction** — `socket-emit.ts` provides clean API route → socket bridge with silent no-ops during build
- **Session model** — JWT in httpOnly cookie + middleware edge decode is solid
- **Component separation** — Clear dashboard/ vs arl/ component directories

### 4.2 Architectural Concerns

**4.2.1 Monolithic socket-server.ts (69KB, 1,589 lines)**
This file is the single biggest risk in the codebase. It handles:
- Socket.io initialization and auth
- All meeting logic (create, join, leave, host controls, analytics)
- Presence tracking
- Typing indicators
- Notification dismiss sync
- Test notification handlers
- All socket event handlers

**Recommendation:** Split into modules:
- `socket-server/init.ts` — Server setup and auth middleware
- `socket-server/meetings.ts` — All meeting logic
- `socket-server/presence.ts` — Online/offline tracking
- `socket-server/messaging.ts` — Typing, conversation rooms
- `socket-server/notifications.ts` — Notification events
- `socket-server/tests.ts` — Test notification handlers

**4.2.2 SQLite Limitations**
SQLite is fine for the current scale (likely <50 restaurants), but will become a bottleneck at:
- ~100+ concurrent connections writing simultaneously
- Large message volumes (SQLite locks on writes)
- If you ever need horizontal scaling (multiple server instances)

**Recommendation:** This is fine for now. If you outgrow it, migrate to PostgreSQL (Drizzle supports it with minimal changes). The `migrate-to-turso.ts` script suggests this was already considered.

**4.2.3 In-Memory Meeting State**
Active meetings are stored in `globalThis.__hubActiveMeetings` (a Map). If the server restarts, all active meetings are lost.

**Recommendation:** For now this is acceptable since meetings are ephemeral. If reliability matters, persist active meeting state to SQLite and recover on startup.

**4.2.4 Migration System**
The migration system in `db/index.ts` uses raw `ALTER TABLE` statements wrapped in try/catch. This works but is fragile — there's no migration version tracking, so you can't tell which migrations have run.

**Recommendation:** Add a `_migrations` table that records which migrations have been applied. Each migration gets a unique ID.

---

## 5. Backend Improvements

### 5.1 Critical Fixes

**5.1.1 Rate Limiting on Auth Endpoints**
`/api/auth/login` and `/api/auth/validate-user` have no rate limiting. An attacker could brute-force 6-digit PINs (1M combinations) quickly.

**Implementation:**
- Add an in-memory rate limiter (IP-based, 5 attempts per minute)
- Lock accounts after 10 failed attempts (require ARL reset)
- Log failed login attempts to audit log

**5.1.2 JWT Secret in Code**
```typescript
const JWT_SECRET = process.env.JWT_SECRET || "the-hub-secret-key-change-in-production";
```
The fallback secret is hardcoded. If `JWT_SECRET` env var is not set, anyone who reads the source code can forge tokens.

**Fix:** Remove the fallback. Throw an error if `JWT_SECRET` is not set in production.

**5.1.3 Missing Foreign Key Constraints**
The Drizzle schema defines no foreign key relationships. `taskCompletions.taskId` doesn't reference `tasks.id`, `messages.conversationId` doesn't reference `conversations.id`, etc. SQLite supports foreign keys but they're not defined.

**Impact:** Orphaned records can accumulate (the `orphaned-cleanup` data management route exists specifically because of this). Defining foreign keys with CASCADE deletes would prevent this automatically.

**5.1.4 Task Scheduler Timezone Issue**
`task-notification-scheduler.ts` uses `new Date().toTimeString().slice(0, 5)` for time comparison. This uses the **server's timezone**, not the restaurant's timezone. If Railway runs in UTC and restaurants are in HST (UTC-10), all task notifications fire 10 hours early.

**Fix:** Store timezone per location in the `locations` table. Convert server time to location timezone before comparing.

### 5.2 Important Improvements

**5.2.1 API Response Consistency**
API routes return inconsistent shapes:
- Some return `{ success: true, data }` 
- Some return `{ tasks: [...] }`
- Some return `{ error: "message" }`
- Some return bare arrays

**Recommendation:** Standardize all API responses:
```typescript
// Success
{ ok: true, data: { ... } }
// Error
{ ok: false, error: { code: "NOT_FOUND", message: "Task not found" } }
```

**5.2.2 Input Validation**
Most API routes do minimal validation. For example, `POST /api/tasks` doesn't validate:
- `dueTime` format (should be HH:mm)
- `recurringDays` contents (should be valid day names)
- `priority` values (should be enum)
- `points` range (should be positive integer)

**Recommendation:** Add a validation layer using Zod schemas:
```typescript
const createTaskSchema = z.object({
  title: z.string().min(1).max(200),
  dueTime: z.string().regex(/^\d{2}:\d{2}$/),
  priority: z.enum(["low", "normal", "high", "urgent"]),
  points: z.number().int().min(1).max(1000),
  // ...
});
```

**5.2.3 API Route Organization**
41 route files exist, but some have multiple HTTP methods doing unrelated things. For example, `/api/messages` uses:
- `GET` — List conversations OR fetch messages (based on query param)
- `POST` — Send a message
- `PUT` — Create a conversation

**Recommendation:** Split into:
- `GET /api/conversations` — List conversations
- `GET /api/conversations/[id]/messages` — Fetch messages
- `POST /api/conversations/[id]/messages` — Send message
- `POST /api/conversations` — Create conversation

**5.2.4 Paginated Responses**
Most list endpoints return ALL records. `GET /api/messages` fetches every message in a conversation. `GET /api/notifications` takes a `limit` but defaults to returning everything.

**Recommendation:** Add cursor-based pagination to all list endpoints:
```typescript
{ data: [...], cursor: "abc123", hasMore: true }
```

**5.2.5 Caching Layer**
Every API call hits SQLite directly. Frequently-read data like tasks, locations, and leaderboard could be cached.

**Recommendation:** Add in-memory caching for:
- Location list (invalidate on location update)
- Today's tasks per location (invalidate on task CRUD or completion)
- Leaderboard (invalidate on task completion)
- ARL list (invalidate on user management)

Use a simple `Map<string, { data: any, expiresAt: number }>` with 30-60 second TTL.

### 5.3 Nice-to-Have Improvements

**5.3.1 Request Logging**
No structured request logging exists. Add middleware that logs:
- Timestamp, method, path, status code, response time
- User ID (from JWT) for authenticated requests
- Request body for mutations (redacting sensitive fields)

**5.3.2 Webhook System**
Allow ARLs to configure webhooks for events like:
- Task completed
- Emergency broadcast sent
- Location went offline
- Meeting ended

This enables integration with Slack, Teams, or custom systems.

**5.3.3 Audit Trail Expansion**
The audit logger (`audit-logger.ts`) only logs bulk operations. Expand to cover:
- All task CRUD operations
- User management changes
- Emergency broadcasts
- Settings changes
- Login/logout events

---

## 6. Frontend Improvements

### 6.1 Critical Fixes

**6.1.1 Dashboard Page Size (1,455 lines)**
`src/app/dashboard/page.tsx` is massive. It contains:
- 15+ `useState` hooks
- 10+ `useEffect` hooks
- 5+ `useCallback` hooks
- Socket event handlers
- Task fetching/completion logic
- Sound management
- Settings popover
- Full JSX layout

**Recommendation:** Extract into custom hooks and sub-components:
- `useDashboardTasks()` — Task fetching, completion, refresh
- `useDashboardSocket()` — All socket event handlers
- `useDashboardSound()` — Sound/chime management
- `DashboardHeader` — Header bar with all icons/controls
- `DashboardSettings` — Settings popover component

**6.1.2 ARL Page Size (1,195 lines)**
Similar issue to the dashboard. The ARL page manages navigation, socket listeners, view rendering, and state for all 14 views.

**Recommendation:** Extract navigation into an `ArlLayout` component and use a proper routing pattern (either URL-based with dynamic segments or a reducer for view state).

**6.1.3 Large Component Files**
Several components are excessively large:
- `restaurant-chat.tsx` — 1,083 lines
- `messaging.tsx` (ARL) — 47,730 bytes
- `task-manager.tsx` — 44,373 bytes
- `data-management.tsx` — 35,670 bytes
- `meeting-room-livekit-custom.tsx` — 85,964 bytes

**Recommendation:** Each of these should be broken into smaller sub-components. For example, `restaurant-chat.tsx` should have:
- `ConversationList.tsx`
- `MessageThread.tsx`
- `MessageInput.tsx`
- `NewChatPicker.tsx`

### 6.2 Important Improvements

**6.2.1 Error Boundaries**
No React Error Boundaries exist. If any component crashes, the entire page goes white.

**Recommendation:** Add error boundaries at:
- App layout level (catch-all with "Something went wrong" UI)
- Dashboard widget level (individual widget failure doesn't take down the whole dashboard)
- Chat panel level (messaging failure doesn't kill the dashboard)

**6.2.2 Loading States**
Many components have no loading skeleton. When data is being fetched:
- Dashboard shows blank areas
- Chat shows empty conversation list
- Task manager shows nothing

**Recommendation:** Add skeleton placeholders using the existing `Skeleton` component for all data-dependent sections.

**6.2.3 Optimistic Updates**
All mutations wait for the server response before updating the UI:
- Task completion waits for API response before showing checkmark
- Message sending waits before showing the message
- Reaction adding waits before showing the emoji

**Recommendation:** Implement optimistic updates for:
- Task completion (show completed immediately, rollback on error)
- Message sending (show message with pending state, confirm or retry on error)
- Reaction toggling (show/remove emoji immediately)

**6.2.4 Form State Management**
The task manager and user management components manage complex form state with many `useState` hooks. This leads to stale closures and inconsistent state.

**Recommendation:** Use `useReducer` for complex form state, or adopt a form library like React Hook Form for the ARL management views.

**6.2.5 Accessibility (a11y)**
- **Keyboard navigation** — Most interactive elements are `<button>` (good) but the PinPad and onscreen keyboard don't support physical keyboard input well
- **Screen readers** — Missing `aria-label` on many icon-only buttons
- **Focus management** — Modal dialogs don't trap focus
- **Color contrast** — Some muted-foreground text may not meet WCAG AA standards in both themes
- **Touch targets** — Some buttons are smaller than the recommended 44x44px minimum for touch

**Recommendation:** Perform a WCAG 2.1 AA audit and fix:
- Add `aria-label` to all icon-only buttons
- Implement focus trapping in modals/dialogs
- Ensure all text meets 4.5:1 contrast ratio
- Ensure all touch targets are ≥44x44px

### 6.3 Nice-to-Have Improvements

**6.3.1 Virtualized Lists**
Message lists, task lists, and notification lists render all items. For conversations with hundreds of messages, this causes performance issues.

**Recommendation:** Use `react-window` or `@tanstack/react-virtual` for:
- Message threads (most impactful)
- Task lists in the ARL task manager
- Notification panel

**6.3.2 Prefetching**
The ARL Hub loads data only when a view is selected. Switching to "Tasks" from "Overview" shows a loading state.

**Recommendation:** Prefetch data for likely-next views. For example, when on "Overview", prefetch tasks and messages in the background.

**6.3.3 Stale-While-Revalidate Pattern**
Currently, every navigation or tab switch does a fresh fetch. Implement SWR pattern:
- Show cached data immediately
- Revalidate in background
- Update UI when fresh data arrives

This makes the app feel instant.

---

## 7. Security Audit

### 7.1 High Priority

| Issue | Severity | Location | Recommendation |
|---|---|---|---|
| No rate limiting on login | **HIGH** | `/api/auth/login` | Add IP-based rate limiter (5/min) |
| Hardcoded JWT fallback secret | **HIGH** | `auth.ts:4` | Remove fallback, throw in production |
| No CSRF protection | **MEDIUM** | All POST routes | Cookie is `sameSite: lax` which helps, but add CSRF token for state-changing operations |
| PIN is only 6 digits | **MEDIUM** | Auth system | Accept for kiosk context, but rate limiting is essential |
| No input sanitization | **MEDIUM** | Message content, task titles | Sanitize HTML/script injection in user-submitted text |
| No API key for internal endpoints | **LOW** | Data management routes | Add admin-only middleware to destructive endpoints |
| Emergency broadcast has no confirmation | **LOW** | `/api/emergency` | Add a confirmation step to prevent accidental sends |

### 7.2 Positive Security Practices
- httpOnly JWT cookies (not accessible via JavaScript)
- Middleware route protection (locations can't access ARL routes)
- PIN hashing with bcrypt
- Session expiry (24h JWT lifetime)
- Soft-delete patterns (data not permanently lost on delete)

---

## 8. Performance Audit

### 8.1 Current Bottlenecks

**8.1.1 N+1 Queries in Conversation List**
`GET /api/messages` (conversation list) runs:
1. Fetch all memberships for user
2. Fetch all conversations
3. For EACH conversation: fetch last message, count unread, fetch members

With 20 conversations, this is 60+ queries per request.

**Fix:** Use a single SQL query with JOINs or subqueries.

**8.1.2 Full Table Scans**
Several queries load all records then filter in JavaScript:
```typescript
let results = ctx.db.select().from(ctx.schema.tasks).all();
if (locationId) results = results.filter(t => t.locationId === locationId);
```

**Fix:** Use WHERE clauses in the query instead of post-fetch filtering.

**8.1.3 Message Reads: Full Table Load**
`GET /api/messages?conversationId=X` loads ALL message reads across ALL conversations, then filters:
```typescript
const reads = db.select().from(schema.messageReads).all();
```

**Fix:** Filter by message IDs in the WHERE clause.

**8.1.4 Bundle Size**
Large dependencies that could be optimized:
- `@apollo/client` (~50KB gzip) — unused, only the ApolloProvider wraps the app
- `lodash` (~70KB gzip) — likely only a few functions used
- `emoji-picker-react` (~35KB gzip) — lazy-load this since it's only in chat

**Recommendation:** 
- Remove `@apollo/client` from the bundle (or at minimum, lazy-load the provider)
- Replace `lodash` with individual imports: `import debounce from 'lodash/debounce'`
- Dynamically import `emoji-picker-react`

**8.1.5 No Database Indexes**
The `add-indexes.ts` script exists but must be run manually. Without indexes:
- `task_completions` lookups by `(task_id, location_id, completed_date)` are slow
- `messages` lookups by `conversation_id` do full table scans
- `message_reads` lookups by `(reader_id, reader_type)` are slow
- `notifications` lookups by `(user_id, is_read)` are slow

**Fix:** Run the index script on deployment, or add the indexes to `runMigrations()`.

### 8.2 Performance Wins Already in Place
- PWA service worker with sensible caching strategies
- Socket.io for real-time (no polling)
- React Compiler enabled (`reactCompiler: true`)
- Framer Motion `AnimatePresence` for efficient animations
- `useCallback`/`useRef` patterns to avoid unnecessary re-renders

---

## 9. Database & Data Layer

### 9.1 Schema Assessment

**Strengths:**
- Clean table design with clear naming conventions
- Comprehensive fields (metadata, audit timestamps, soft-delete)
- Good separation of concerns (messages, reactions, reads are separate tables)

**Issues:**

**9.1.1 No Foreign Keys**
None of the 20+ tables define foreign key constraints. This means:
- Deleting a task leaves orphaned completions
- Deleting a conversation leaves orphaned messages, reads, members
- Deleting a location leaves orphaned sessions, tasks, completions

**Fix:** Add foreign keys with `ON DELETE CASCADE` for child records.

**9.1.2 Text Dates Instead of Integer Timestamps**
All dates are stored as ISO text strings. SQLite comparisons on text dates work but are slower than integer comparisons. For example, `createdAt: text("created_at")` could be `createdAt: integer("created_at")` storing Unix timestamps.

**Impact:** Minor for current scale. Only worth changing if performance becomes an issue.

**9.1.3 JSON Stored in Text Columns**
Several columns store JSON as text:
- `recurringDays` — `["mon","tue","wed"]`
- `deletedBy` — `["uuid1","uuid2"]`
- `viewedBy` — `["uuid1","uuid2"]`
- `targetLocationIds` — `["uuid1","uuid2"]`
- `metadata` — arbitrary JSON

**Impact:** Can't query within these fields efficiently. For `viewedBy` and `targetLocationIds`, consider junction tables instead.

**9.1.4 No Unique Constraints on Compound Keys**
- `task_completions` should have a unique constraint on `(task_id, location_id, completed_date)` to prevent double-completions
- `message_reads` should have a unique constraint on `(message_id, reader_id)` to prevent duplicate reads
- `conversation_members` should have a unique constraint on `(conversation_id, member_id)` to prevent duplicate memberships

### 9.2 Data Management
The 16 data management operations in the ARL hub are comprehensive:
- Purge old messages, notifications, conversations, tasks
- Vacuum database (reclaim space)
- Integrity check
- Orphaned record cleanup
- Duplicate detection
- Data export (JSON)
- System report
- Usage analytics
- Archive old data
- Reset leaderboard

**Assessment:** This is excellent for a self-managed system. The main gap is that these are manual operations. Consider automating the most important ones (purge old messages, vacuum) on a cron schedule.

---

## 10. UX/UI Improvements

### 10.1 Restaurant Dashboard

**10.1.1 Task Completion Feedback**
When a task is completed, the celebratory animation plays but there's no clear visual indication of which task was just completed in the timeline. The task simply updates its state.

**Recommendation:** Add a brief highlight animation (green flash or checkmark animation) on the completed task before it moves to the "completed" section.

**10.1.2 Overdue Task Overlay UX**
The fullscreen overdue overlay blocks ALL interaction until dismissed. If a kiosk operator needs to complete the task first (e.g., the task requires navigating to a form), they can't.

**Recommendation:** Add a "Snooze 5 min" button alongside "Acknowledge & Dismiss" so the operator can complete the task first.

**10.1.3 Clock Prominence**
The current time display is in the header, but for a kitchen environment where timing is critical, it could be more prominent.

**Recommendation:** Add a large, always-visible clock (possibly integrated into the screensaver or a persistent corner widget).

**10.1.4 Quick Actions**
There's no way for a restaurant to quickly report an issue, request help, or mark a task as "in progress" (vs. completed).

**Recommendation:** Add a quick-action button (FAB or hold menu) with options like:
- "Need help" — sends notification to ARL
- "Mark as in progress" — shows task is being worked on
- "Report issue" — quick issue report to ARL

### 10.2 ARL Hub

**10.2.1 Overview Dashboard**
The ARL "overview" view could show more at a glance:
- How many locations are online right now
- How many tasks are overdue across all locations
- Today's completion rate
- Active emergency alerts
- Unread messages count

**Recommendation:** Build a proper overview dashboard with KPI cards and sparkline charts.

**10.2.2 Bulk Operations UI**
The task manager allows creating/editing one task at a time. For a franchise with 20+ locations, creating the same task for each location is tedious.

**Recommendation:** The bulk task API exists (`/api/data-management/bulk-tasks`) but there's no UI for it. Add a "Bulk Create" flow in the task manager.

**10.2.3 Mobile Navigation**
The ARL Hub uses swipe navigation between views, which is good. But there's no visual cue about which views are available to the left/right.

**Recommendation:** The page indicator dots exist but could be more informative — show the view name on long-press, or add a bottom tab bar for the most common views (Messages, Tasks, Locations).

---

## 11. New Feature Recommendations

### 11.1 High Impact — Should Implement

**11.1.1 Task Templates**
Allow ARLs to create task templates (e.g., "Opening Checklist", "Closing Checklist") that can be applied to locations in one click.

**Why:** Reduces repetitive task creation. Most KFC locations follow the same daily routine.

**Implementation:**
- New `task_templates` table
- Template contains multiple tasks with relative times
- "Apply template" creates all tasks for the selected location(s)

**11.1.2 Daily Summary Report**
Auto-generate a daily summary at end of business:
- Tasks completed vs. missed per location
- Average completion time (early vs. on-time vs. late)
- Streak status
- Points earned
- Notable achievements

**Why:** ARLs need a quick daily digest without manually checking each location.

**Implementation:**
- Cron job at configurable time (e.g., 11 PM)
- Store report in a `daily_reports` table
- Show in ARL overview
- Optionally email to ARLs

**11.1.3 Task Categories/Tags**
Currently tasks have `type` (task/reminder/cleaning) but no flexible categorization.

**Why:** Allows filtering by category (e.g., "Food Safety", "Customer Service", "Maintenance") and better analytics.

**Implementation:**
- Add `category` and `tags` fields to tasks table
- ARL can manage categories
- Dashboard can filter by category
- Analytics can report by category

**11.1.4 Photo Proof of Completion**
Allow restaurant crew to attach a photo when completing a task (e.g., photo of clean fryer, photo of temperature log).

**Why:** Accountability and verification for compliance-sensitive tasks.

**Implementation:**
- Add optional photo upload on task completion
- Store images in `data/task-photos/` (or cloud storage)
- ARL can review photos in task manager
- Flag tasks that require photo proof

**11.1.5 Recurring Task Exceptions**
Currently, recurring tasks can't have exceptions (e.g., "every day except holidays" or "skip this week").

**Why:** Real-world schedules have exceptions. Without this, ARLs must hide/unhide tasks manually.

**Implementation:**
- Add `exceptions` field to tasks (JSON array of dates to skip)
- ARL can add exceptions from the calendar or task manager
- Task scheduler skips excepted dates

### 11.2 Medium Impact — Nice to Have

**11.2.1 Location Grouping/Regions**
Group locations into regions (e.g., "North Shore", "Honolulu", "West Side") so ARLs can:
- Send emergency broadcasts to a region
- View analytics by region
- Assign tasks to a region

**11.2.2 Shift Tracking**
Track which shift is active at each location (opening, mid, closing). This allows:
- Tasks assigned to specific shifts
- Analytics broken down by shift
- Knowing who was working when a task was completed/missed

**11.2.3 Custom Dashboard Layouts**
Allow ARLs to configure what widgets appear on each location's dashboard and in what arrangement.

**11.2.4 Announcement Board**
A persistent announcement section on the dashboard (separate from ticker) for important ongoing messages like "New menu item launching March 1" or "Health inspection scheduled this week."

**11.2.5 Training Module**
Simple embedded training content:
- Short video clips or images showing how to complete tasks
- Attach training materials to specific tasks
- Track which locations have viewed training

**11.2.6 Checklist Tasks**
Tasks that have sub-steps (checklist items). For example, "Opening Checklist" with 15 sub-items that must all be checked before the task is complete.

**11.2.7 Task Dependencies**
Some tasks depend on others. For example, "Serve food" depends on "Prep food" being completed first.

**11.2.8 Maintenance Requests**
Allow locations to submit maintenance requests (broken equipment, supply needs) that ARLs can track and respond to.

### 11.3 Low Impact — Future Consideration

**11.3.1 Multi-Language Support (i18n)**
If the franchise expands to non-English-speaking areas, add internationalization.

**11.3.2 Custom Branding per Franchise**
Allow different franchise owners to customize colors, logo, and branding.

**11.3.3 API for Third-Party Integration**
Expose a public API (with API keys) for integration with POS systems, inventory management, etc.

**11.3.4 Offline Mode**
Full offline support using the PWA service worker to queue task completions and messages when internet is down, syncing when connection is restored.

---

## 12. Dead Code & Technical Debt

### 12.1 Dead Code to Clean Up

| Item | Location | Issue |
|---|---|---|
| **GraphQL layer** | `src/graphql/`, `src/lib/graphql-*.ts`, `src/lib/apollo-provider.tsx` | Full scaffolding, zero usage. ApolloProvider wraps entire app adding bundle weight. (User chose to keep for now) |
| **NotificationSystem component** | `src/components/dashboard/notification-system.tsx` (19KB) | Functionality merged into `notification-bell.tsx` but file still exists |
| **StreamViewer** | `src/components/dashboard/stream-viewer.tsx` (681 bytes) | Minimal stub component, appears unused |
| **Streaks API** | `src/app/api/streaks/` | Empty directory |
| **Unused imports** | Various files | Multiple files have unused imports (e.g., X, Bell, etc.) |
| **Markdown documentation files** | Root directory | 6+ .md files from previous sessions (MOBILE_AUDIT.md, SESSION_FEB_26_2026.md, etc.) |

### 12.2 Technical Debt

| Item | Severity | Description |
|---|---|---|
| **No TypeScript strict mode** | Medium | `tsconfig.json` doesn't enforce `strict: true`, allowing implicit `any` types |
| **`any` types in resolvers** | Medium | GraphQL resolvers use `any` extensively |
| **Raw SQL mixed with Drizzle** | Medium | Some routes use raw `sqlite.prepare()` alongside Drizzle ORM queries |
| **Test coverage** | Medium | Only 18 tests exist (auth + achievements). No tests for messaging, tasks, meetings, notifications |
| **No E2E tests for critical flows** | High | Only 1 Playwright test (auth). Missing tests for task completion, messaging, emergency broadcast |
| **Console.log statements** | Low | Hundreds of `console.log` in production code |
| **Magic numbers** | Low | Hardcoded values like `30 * 60 * 1000` (30 min), `5 * 60 * 1000` (5 min) should be named constants |

---

## 13. Priority Roadmap

### Phase 1 — Stability & Security (1-2 weeks)
1. Add rate limiting to auth endpoints
2. Remove hardcoded JWT fallback secret
3. Add database indexes to `runMigrations()`
4. Fix timezone handling in task notification scheduler
5. Add unique constraints to prevent duplicate records
6. Add error boundaries to React app
7. Delete `notification-system.tsx` (merged into bell)

### Phase 2 — Performance & Polish (2-3 weeks)
1. Fix N+1 queries in conversation list
2. Fix full-table-scan patterns in API routes
3. Split `socket-server.ts` into modules
4. Split large components (dashboard page, ARL page, restaurant chat)
5. Add loading skeletons to all data-dependent views
6. Add optimistic updates for task completion and messaging
7. Automate data purge/vacuum on cron schedule

### Phase 3 — Features (3-4 weeks)
1. Task templates + bulk creation UI
2. Daily summary report (auto-generated)
3. Photo proof of completion
4. Overdue overlay snooze button
5. ARL overview dashboard with KPI cards
6. Task categories/tags
7. Recurring task exceptions

### Phase 4 — Future Growth (ongoing)
1. Checklist sub-tasks
2. Location grouping/regions
3. Announcement board
4. Training module integration
5. Maintenance request system
6. Comprehensive E2E test suite

---

*This audit represents a thorough analysis of the codebase as of February 27, 2026. Recommendations are prioritized by impact and effort. The project is well-built and feature-rich — the suggestions above are refinements and expansions, not fundamental rewrites.*
