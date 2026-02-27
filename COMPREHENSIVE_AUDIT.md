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
14. [Implementation Log](#14-implementation-log)
15. [Native iOS/Android App Exploration](#15-native-iosandroid-app-exploration)

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
| **Validation** | Zod | 3.x |
| **Virtualization** | @tanstack/react-virtual | 3.x |
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
- **Database migrations** — Version-tracked migrations via `_migrations` table with `migrate()` helper ✅ *Updated*
- **Sentry monitoring** — Error tracking for client, server, and edge
- **PWA support** — Service worker with Workbox caching strategies
- **Health endpoint** — `/api/health` for uptime monitoring
- **Build ID tracking** — Client/server build parity checks
- **Database indexes** — 5 unique indexes + 5 performance indexes auto-applied via tracked migrations ✅ *Updated*
- **Data export** — JSON export of all database tables
- **Rate limiting** — IP-based sliding window (5 attempts/min, 5-min lockout) on auth endpoints ✅ *New*
- **Input validation** — Zod schemas for tasks, auth, messages, notifications, emergency broadcasts ✅ *New*
- **API response helpers** — Standardized `apiSuccess`/`apiError` with common error codes ✅ *New*
- **Caching layer** — In-memory TTL cache with get-or-set pattern and prefix invalidation ✅ *New*
- **Pagination utilities** — Cursor-based pagination helpers for API routes ✅ *New*
- **Socket server modules** — Split into `socket-handlers/` (meetings, tasks, tests, state, types) ✅ *New*
- **Foreign key constraints** — Schema-level FKs on taskCompletions, messages, conversationMembers, messageReads, messageReactions ✅ *New*
- **JWT security** — Production throws if `JWT_SECRET` not set; dev-only fallback ✅ *New*
- **Hawaii timezone fix** — Task notification scheduler uses Hawaii time consistently ✅ *New*
- **SWR fetch hook** — Lightweight stale-while-revalidate data fetching with caching and deduping ✅ *New*
- **Dashboard sound hook** — Reusable `useDashboardSound` for mute state, toggle, and chime playback ✅ *New*

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

**4.2.1 ~~Monolithic socket-server.ts (69KB, 1,589 lines)~~ ✅ RESOLVED**
This file was the single biggest risk in the codebase. **Now resolved** — split from 1,589 lines to 348 lines.

**Implemented modular structure:**
- `socket-server.ts` — Server setup, auth middleware, and orchestration (348 lines)
- `socket-handlers/meetings.ts` — All meeting logic
- `socket-handlers/tasks.ts` — Task-related socket events
- `socket-handlers/tests.ts` — Test notification handlers
- `socket-handlers/state.ts` — Shared state (active meetings, online users)
- `socket-handlers/types.ts` — Shared TypeScript types

**4.2.2 SQLite Limitations**
SQLite is fine for the current scale (likely <50 restaurants), but will become a bottleneck at:
- ~100+ concurrent connections writing simultaneously
- Large message volumes (SQLite locks on writes)
- If you ever need horizontal scaling (multiple server instances)

**Recommendation:** This is fine for now. If you outgrow it, migrate to PostgreSQL (Drizzle supports it with minimal changes). The `migrate-to-turso.ts` script suggests this was already considered.

**4.2.3 In-Memory Meeting State**
Active meetings are stored in `globalThis.__hubActiveMeetings` (a Map). If the server restarts, all active meetings are lost.

**Recommendation:** For now this is acceptable since meetings are ephemeral. If reliability matters, persist active meeting state to SQLite and recover on startup.

**4.2.4 ~~Migration System~~ ✅ RESOLVED**
The migration system now uses a `_migrations` table that tracks which migrations have been applied. Each migration has a unique ID and is wrapped in a `migrate()` helper that checks if it's already been applied before running. 31 migrations are tracked, including schema changes, unique indexes, and performance indexes.

---

## 5. Backend Improvements

### 5.1 Critical Fixes

**5.1.1 ~~Rate Limiting on Auth Endpoints~~ ✅ IMPLEMENTED**
Added IP-based sliding window rate limiter to `/api/auth/login`:
- 5 attempts per minute per IP
- 5-minute lockout after exceeding limit
- Rate limit reset on successful login
- Client IP extraction from `x-forwarded-for` headers
- File: `src/lib/rate-limiter.ts`

**5.1.2 ~~JWT Secret in Code~~ ✅ IMPLEMENTED**
Removed hardcoded JWT secret fallback. Now throws an error in production if `JWT_SECRET` env var is not set. Dev-only fallback retained for local development.
- Fixed in: `src/lib/auth.ts` and `src/lib/socket-server.ts`

**5.1.3 ~~Missing Foreign Key Constraints~~ ✅ IMPLEMENTED**
Added foreign key references to the Drizzle schema for:
- `taskCompletions.taskId` → `tasks.id`
- `taskCompletions.locationId` → `locations.id`
- `messages.conversationId` → `conversations.id`
- `conversationMembers.conversationId` → `conversations.id`
- `messageReads.messageId` → `messages.id`
- `messageReactions.messageId` → `messages.id`
- File: `src/lib/db/schema.ts`

**5.1.4 ~~Task Scheduler Timezone Issue~~ ✅ IMPLEMENTED**
Fixed timezone handling in `task-notification-scheduler.ts`:
- All time comparisons now use `toLocaleTimeString('en-US', { timeZone: 'Pacific/Honolulu' })` for Hawaii time
- Midnight rollover timer calculates next midnight in Hawaii time
- Consistent timezone across task due time checks and scheduler resets

### 5.2 Important Improvements

**5.2.1 ~~API Response Consistency~~ ✅ IMPLEMENTED (utilities created)**
Created standardized API response helpers in `src/lib/api-response.ts`:
- `apiSuccess(data, status?)` — Returns `{ ok: true, data }`
- `apiError(code, message, status)` — Returns `{ ok: false, error: { code, message } }`
- `ApiErrors` object with pre-built common errors (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, VALIDATION, RATE_LIMITED, INTERNAL)
- Ready for incremental adoption across API routes

**5.2.2 ~~Input Validation~~ ✅ IMPLEMENTED (schemas created)**
Created Zod validation schemas in `src/lib/validations.ts`:
- `createTaskSchema` — Task title, dueTime (HH:mm), priority enum, points range, recurring days
- `loginSchema` — userId + pin format validation
- `sendMessageSchema` — Message content + conversation ID
- `createNotificationSchema` — Notification type, priority, message, target
- `emergencyBroadcastSchema` — Emergency message + target locations
- `validate(schema, data)` helper that returns typed `{ success, data, errors }`
- Ready for incremental adoption across API routes

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

**5.2.4 ~~Paginated Responses~~ ✅ IMPLEMENTED (utilities created)**
Created cursor-based pagination utilities in `src/lib/pagination.ts`:
- `parsePaginationParams(request)` — Extracts `cursor`, `limit`, `direction` from URL params
- `paginatedResponse(items, limit, cursorField)` — Builds `{ data, cursor, hasMore }` response
- Default limit: 50, max limit: 200
- Ready for incremental adoption across list endpoints

**5.2.5 ~~Caching Layer~~ ✅ IMPLEMENTED**
Created in-memory caching layer in `src/lib/cache.ts`:
- `cache.get(key)` / `cache.set(key, value, ttlMs)` — Basic get/set with TTL
- `cache.getOrSet(key, fetcher, ttlMs)` — Cache-aside pattern
- `cache.invalidate(key)` / `cache.invalidatePrefix(prefix)` — Targeted and prefix-based invalidation
- `cache.clear()` — Full cache reset
- Automatic periodic cleanup of expired entries (every 60s)
- Default TTL: 30 seconds

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

**6.1.1 Dashboard Page Size (1,455 → 1,119 lines) ✅ PARTIALLY RESOLVED**
`src/app/dashboard/page.tsx` has been reduced by ~336 lines. Extracted so far:
- `CalendarModal` → `src/components/dashboard/calendar-modal.tsx` (~335 lines extracted)
- `useDashboardSound()` → `src/hooks/use-dashboard-sound.ts` (~85 lines extracted)

**Remaining extraction opportunities:**
- `useDashboardTasks()` — Task fetching, completion, refresh
- `useDashboardSocket()` — All socket event handlers
- `DashboardHeader` — Header bar with all icons/controls
- `DashboardSettings` — Settings popover component

**6.1.2 ARL Page Size (1,195 → 1,007 lines) ✅ PARTIALLY RESOLVED**
`src/app/arl/page.tsx` has been reduced by ~188 lines. Extracted so far:
- `OverviewContent` replaced with enhanced `OverviewDashboard` → `src/components/arl/overview-dashboard.tsx` (~370 lines)
- New API endpoint: `src/app/api/analytics/overview/route.ts`

**Remaining extraction opportunities:**
- Extract navigation into an `ArlLayout` component
- Use URL-based routing or reducer pattern for view state
- Extract remaining large view renderers into standalone components

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

**6.3.1 ~~Virtualized Lists~~ ✅ DEPENDENCY INSTALLED**
`@tanstack/react-virtual` has been installed and is ready for use. Not yet integrated into components.

**Next steps — integrate into:**
- Message threads (most impactful)
- Task lists in the ARL task manager
- Notification panel

**6.3.2 Prefetching**
The ARL Hub loads data only when a view is selected. Switching to "Tasks" from "Overview" shows a loading state.

**Recommendation:** Prefetch data for likely-next views. For example, when on "Overview", prefetch tasks and messages in the background.

**6.3.3 ~~Stale-While-Revalidate Pattern~~ ✅ IMPLEMENTED**
Created lightweight SWR hook in `src/hooks/use-swr-fetch.ts`:
- Shows cached data immediately, revalidates in background
- Configurable TTL (default 30s), deduplication of concurrent requests
- `mutate()` function for manual cache updates
- `revalidate()` for forced refresh
- Supports `revalidateOnFocus` and `revalidateOnReconnect` options
- Ready for adoption across components

---

## 7. Security Audit

### 7.1 High Priority

| Issue | Severity | Location | Status |
|---|---|---|---|
| ~~No rate limiting on login~~ | ~~**HIGH**~~ | `/api/auth/login` | ✅ **FIXED** — IP-based rate limiter added (5/min, 5-min lockout) |
| ~~Hardcoded JWT fallback secret~~ | ~~**HIGH**~~ | `auth.ts`, `socket-server.ts` | ✅ **FIXED** — Throws in production if not set |
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

**8.1.5 ~~No Database Indexes~~ ✅ RESOLVED**
Database indexes are now auto-applied via the tracked migration system in `db/index.ts`.

**Unique indexes added (prevent duplicates):**
- `task_completions` — `(task_id, location_id, completed_date)`
- `message_reads` — `(message_id, reader_id)`
- `conversation_members` — `(conversation_id, member_id)`
- `push_subscriptions` — `(endpoint)`
- `locations` — `(name)`

**Performance indexes added:**
- `messages` — `(conversation_id, created_at)`
- `notifications` — `(user_id, is_read)`
- `sessions` — `(location_id, is_active)`
- `tasks` — `(location_id, is_hidden)`
- `message_reads` — `(reader_id, reader_type)`

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

**9.1.1 ~~No Foreign Keys~~ ✅ RESOLVED**
Foreign key references added to the Drizzle schema for key relationships:
- `taskCompletions` → `tasks`, `locations`
- `messages` → `conversations`
- `conversationMembers` → `conversations`
- `messageReads` → `messages`
- `messageReactions` → `messages`

*Note: SQLite enforces FKs only on new databases. Existing databases retain the orphaned-cleanup route as a safety net.*

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

**9.1.4 ~~No Unique Constraints on Compound Keys~~ ✅ RESOLVED**
Unique indexes now enforced via tracked migrations:
- ✅ `task_completions` — `UNIQUE(task_id, location_id, completed_date)`
- ✅ `message_reads` — `UNIQUE(message_id, reader_id)`
- ✅ `conversation_members` — `UNIQUE(conversation_id, member_id)`
- ✅ `push_subscriptions` — `UNIQUE(endpoint)`
- ✅ `locations` — `UNIQUE(name)`

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

**10.2.1 ~~Overview Dashboard~~ ✅ IMPLEMENTED**
Built a full ARL Overview Dashboard (`src/components/arl/overview-dashboard.tsx`) with:
- **KPI cards** — Locations online, tasks overdue, completion rate, points earned today
- **Emergency alert banner** — Prominent red banner when active emergencies exist
- **7-day completion trend** — Sparkline area chart showing daily completion rates
- **Location performance table** — Per-location completion rate + task counts with color coding
- **Real-time updates** — Socket event listeners for live refresh on task completions
- **API endpoint** — `GET /api/analytics/overview` aggregates all KPI data server-side
- **Loading states** — Skeleton placeholders while data loads
- **Auto-refresh** — Reloads data every 5 minutes

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
1. ✅ ~~Add rate limiting to auth endpoints~~ — `src/lib/rate-limiter.ts`
2. ✅ ~~Remove hardcoded JWT fallback secret~~ — `auth.ts`, `socket-server.ts`
3. ✅ ~~Add database indexes to `runMigrations()`~~ — 5 unique + 5 performance indexes
4. ✅ ~~Fix timezone handling in task notification scheduler~~ — Hawaii time
5. ✅ ~~Add unique constraints to prevent duplicate records~~ — 5 unique indexes
6. Add error boundaries to React app
7. Delete `notification-system.tsx` (merged into bell)

### Phase 2 — Performance & Polish (2-3 weeks)
1. Fix N+1 queries in conversation list
2. Fix full-table-scan patterns in API routes
3. ✅ ~~Split `socket-server.ts` into modules~~ — 1,589 → 348 lines + socket-handlers/
4. ✅ ~~Split large components~~ (partially) — CalendarModal, OverviewDashboard, useDashboardSound extracted
5. Add loading skeletons to all data-dependent views
6. Add optimistic updates for task completion and messaging
7. Automate data purge/vacuum on cron schedule

### Phase 3 — Features (3-4 weeks)
1. Task templates + bulk creation UI
2. Daily summary report (auto-generated)
3. Photo proof of completion
4. Overdue overlay snooze button
5. ✅ ~~ARL overview dashboard with KPI cards~~ — `overview-dashboard.tsx` + analytics API
6. Task categories/tags
7. Recurring task exceptions

### Phase 4 — Future Growth (ongoing)
1. Checklist sub-tasks
2. Location grouping/regions
3. Announcement board
4. Training module integration
5. Maintenance request system
6. Comprehensive E2E test suite
7. **Native iOS/Android app** — See Section 15

---

## 14. Implementation Log

*Changes implemented during the Feb 27, 2026 audit session.*

### 14.1 New Files Created

| File | Purpose | Lines |
|---|---|---|
| `src/lib/rate-limiter.ts` | IP-based sliding window rate limiter with lockout | ~100 |
| `src/lib/api-response.ts` | Standardized API success/error response helpers | ~60 |
| `src/lib/validations.ts` | Zod validation schemas for all major entities | ~92 |
| `src/lib/pagination.ts` | Cursor-based pagination utilities | ~70 |
| `src/lib/cache.ts` | In-memory TTL cache with get-or-set pattern | ~90 |
| `src/hooks/use-dashboard-sound.ts` | Reusable dashboard sound management hook | ~85 |
| `src/hooks/use-swr-fetch.ts` | Lightweight SWR data fetching hook | ~120 |
| `src/components/dashboard/calendar-modal.tsx` | Extracted CalendarModal from dashboard page | ~335 |
| `src/components/arl/overview-dashboard.tsx` | New ARL overview with KPIs, charts, tables | ~370 |
| `src/app/api/analytics/overview/route.ts` | API endpoint for ARL overview KPI aggregation | ~130 |
| `src/lib/socket-handlers/meetings.ts` | Meeting socket event handlers | — |
| `src/lib/socket-handlers/tasks.ts` | Task socket event handlers | — |
| `src/lib/socket-handlers/tests.ts` | Test notification socket handlers | — |
| `src/lib/socket-handlers/state.ts` | Shared socket state (active meetings, online users) | — |
| `src/lib/socket-handlers/types.ts` | Shared TypeScript types for socket handlers | — |

### 14.2 Files Modified

| File | Change Summary |
|---|---|
| `src/lib/socket-server.ts` | 1,589 → 348 lines; modularized into socket-handlers/ |
| `src/lib/db/index.ts` | Added `_migrations` table, `migrate()` helper, 31 tracked migrations |
| `src/lib/db/schema.ts` | Added foreign key references on 6 relationship columns |
| `src/lib/auth.ts` | JWT secret: throw in production, dev-only fallback |
| `src/lib/task-notification-scheduler.ts` | Hawaii timezone fix for all time comparisons |
| `src/app/api/auth/login/route.ts` | Integrated rate limiter on both login paths |
| `src/app/dashboard/page.tsx` | 1,455 → 1,119 lines; extracted CalendarModal + sound hook |
| `src/app/arl/page.tsx` | 1,195 → 1,007 lines; replaced OverviewContent with OverviewDashboard |
| `src/components/dashboard/seasonal-theme.tsx` | Expanded to 20+ holidays with year-round coverage |
| `src/components/emoji-quick-replies.tsx` | Now sends emoji + text instead of emoji only |
| `src/app/api/tasks/complete/route.ts` | Real-time notification hooks for task completions |
| `src/app/api/tasks/route.ts` | Real-time notification hooks |
| `src/app/api/tasks/uncomplete/route.ts` | Real-time notification hooks |
| `src/app/api/data-management/bulk-tasks/route.ts` | Real-time notification hooks |

### 14.3 Dependencies Added

| Package | Purpose |
|---|---|
| `zod` | Runtime input validation with TypeScript inference |
| `@tanstack/react-virtual` | Virtual scrolling for large lists (installed, not yet integrated) |

### 14.4 Implementation Summary

| Metric | Value |
|---|---|
| **Files changed** | 32 |
| **Lines added** | ~4,014 |
| **Lines removed** | ~2,196 |
| **Net change** | +1,818 lines |
| **New utility modules** | 5 (rate-limiter, api-response, validations, pagination, cache) |
| **New React hooks** | 2 (use-dashboard-sound, use-swr-fetch) |
| **New components** | 2 (calendar-modal, overview-dashboard) |
| **New API endpoints** | 1 (analytics/overview) |
| **Migrations tracked** | 31 |
| **Indexes added** | 10 (5 unique + 5 performance) |

---

## 15. Native iOS/Android App Exploration

### 15.1 Current State: PWA

The Hub currently ships as a **Progressive Web App (PWA)** using `next-pwa` + Workbox. This provides:
- Home screen installation on iOS and Android
- Service worker caching for offline-capable static assets
- Web push notifications (via VAPID) for ARLs
- Full responsive design for mobile/tablet/desktop

**What the PWA cannot do:**
- Background push notifications on iOS (requires native app)
- Access native device features (NFC, Bluetooth, biometrics, health sensors)
- App Store/Play Store presence (discoverability, trust)
- Reliable background execution (sync, location tracking)
- Native-quality animations and gesture handling
- Siri/Google Assistant integration

### 15.2 Why Consider a Native App?

| Driver | Impact | Priority |
|---|---|---|
| **iOS push notifications** | PWA push is unreliable on iOS; native guarantees delivery | **HIGH** |
| **App Store presence** | ARLs expect to find "The Hub" in the store | **MEDIUM** |
| **Biometric auth** | Face ID / fingerprint for ARL login instead of PIN | **MEDIUM** |
| **Background sync** | Sync task completions even when app is backgrounded | **MEDIUM** |
| **Native UX quality** | Smoother gestures, haptic feedback, native navigation transitions | **LOW** |
| **Offline-first** | SQLite on device with sync to server for true offline support | **LOW** |

### 15.3 Approach Options

#### Option A: React Native (Expo) — **Recommended**

**Why:** The existing codebase is React + TypeScript. React Native with Expo allows maximum code sharing.

| Aspect | Details |
|---|---|
| **Framework** | React Native + Expo SDK 52+ |
| **Language** | TypeScript (same as web) |
| **Code sharing** | 60-80% of business logic, hooks, types, and API client can be shared |
| **UI** | Rebuild UI with React Native components (no DOM, no TailwindCSS) |
| **Navigation** | React Navigation (native stack, tabs, drawers) |
| **Real-time** | Socket.io client works in React Native natively |
| **Push** | Expo Notifications (native APNs + FCM) |
| **Auth** | Expo SecureStore for JWT tokens + biometric unlock |
| **Charts** | `react-native-svg` + `victory-native` or `react-native-gifted-charts` |
| **Video** | LiveKit React Native SDK (exists, well-maintained) |
| **Build** | EAS Build (Expo Application Services) for cloud builds |
| **Distribution** | App Store + Google Play via EAS Submit |
| **Timeline** | 6-10 weeks for MVP (ARL features only) |

**Shared code structure:**
```
the-hub/
├── web/                    # Next.js web app (current)
│   ├── src/app/            # Web pages
│   ├── src/components/     # Web components (React DOM)
│   └── src/hooks/          # Web-specific hooks
├── mobile/                 # React Native app (new)
│   ├── app/                # Expo Router screens
│   ├── components/         # Native components (React Native)
│   └── hooks/              # Mobile-specific hooks
├── shared/                 # Shared code (new)
│   ├── types/              # TypeScript types/interfaces
│   ├── api/                # API client functions
│   ├── lib/                # Business logic (validation, formatting)
│   └── constants/          # Shared constants
```

**What can be shared immediately:**
- All TypeScript types and interfaces
- API client functions (fetch calls)
- Zod validation schemas
- Business logic (date formatting, time calculations, point calculations)
- Socket.io event names and handler logic
- Constants (achievement definitions, notification types, etc.)

**What must be rewritten for native:**
- All UI components (React DOM → React Native components)
- Navigation (Next.js routing → React Navigation)
- Styling (TailwindCSS → StyleSheet or NativeWind)
- Storage (localStorage → AsyncStorage/SecureStore)
- Notifications (web-push → Expo Notifications)
- Audio (HTML5 Audio → expo-av)
- Camera/photos for task proof (expo-camera, expo-image-picker)

#### Option B: Capacitor (Ionic) — Wrap Existing Web App

**Why:** Wraps the existing Next.js app in a native WebView container. Fastest to ship.

| Pros | Cons |
|---|---|
| Almost zero code changes | WebView performance (not truly native) |
| Ships in 1-2 weeks | Limited access to native APIs |
| Single codebase for web + mobile | Users can tell it's a web app in a wrapper |
| Capacitor plugins for push, biometrics, etc. | No native navigation gestures |
| Lower maintenance burden | iOS App Store may reject "web wrapper" apps |

**Best for:** Quick App Store presence with minimal investment. Not recommended long-term.

#### Option C: Flutter — Full Rewrite

| Pros | Cons |
|---|---|
| True native performance | Zero code sharing with existing codebase |
| Beautiful cross-platform UI | Dart language (team must learn) |
| Strong ecosystem | 12-16 weeks minimum for parity |
| Google backing | Separate maintenance burden |

**Not recommended** given the existing React/TypeScript investment.

### 15.4 Recommended MVP Scope (React Native / Expo)

Build **ARL-only** features first — restaurant kiosks will continue using the web app in Chrome Kiosk mode (they're fixed hardware).

#### MVP Feature Set

| Feature | Priority | Complexity |
|---|---|---|
| **PinPad login + biometrics** | P0 | Low |
| **Overview dashboard** (KPI cards, charts) | P0 | Medium |
| **Task management** (view, create, edit) | P0 | Medium |
| **Push notifications** (native APNs/FCM) | P0 | Medium |
| **Messaging** (conversations, send/receive) | P0 | High |
| **Location status** (online/offline monitoring) | P1 | Low |
| **Emergency broadcast** (send alerts) | P1 | Low |
| **Leaderboard** | P1 | Low |
| **Meeting join** (LiveKit) | P2 | High |
| **Forms viewer** (PDF) | P2 | Medium |
| **Data management** | P3 | Medium |

#### MVP Timeline (React Native / Expo)

| Week | Milestone |
|---|---|
| **1-2** | Project setup, shared code extraction, auth flow with biometrics |
| **3-4** | Overview dashboard, task management, location monitoring |
| **5-6** | Messaging system with real-time Socket.io |
| **7-8** | Push notifications (APNs + FCM), emergency broadcasts |
| **9-10** | Testing, polish, App Store / Play Store submission |

### 15.5 Technical Considerations

**15.5.1 API Compatibility**
The existing REST API serves the web app and would serve the mobile app identically. No backend changes needed for MVP — the mobile app is purely a new frontend.

**15.5.2 Authentication**
- Current: JWT in httpOnly cookie (browser-only)
- Mobile: JWT stored in Expo SecureStore, sent as `Authorization: Bearer <token>` header
- Backend change: Accept both cookie and Bearer token auth (add `Authorization` header check to `getSession()`)

**15.5.3 Real-time Communication**
Socket.io client works natively in React Native. The mobile app connects to the same WebSocket server. No backend changes needed.

**15.5.4 Push Notifications**
- Current: Web Push via VAPID (unreliable on iOS)
- Mobile: Expo Notifications → APNs (iOS) + FCM (Android)
- Backend change: Store Expo push tokens in a `mobile_push_tokens` table; add Expo push sending alongside web push
- Library: `expo-notifications` + `expo-server-sdk` (server-side)

**15.5.5 Offline Support**
- Use `@tanstack/react-query` with `persistQueryClient` for automatic offline caching
- Queue mutations (task completions, messages) in local SQLite when offline
- Sync queue on reconnection with conflict resolution (server wins for tasks, merge for messages)

**15.5.6 App Store Requirements**
- iOS: Requires Apple Developer Account ($99/year), Xcode for archive signing
- Android: Requires Google Play Developer Account ($25 one-time)
- Both: Privacy policy, app icons (1024x1024), screenshots for all device sizes
- EAS Build handles the actual build/signing process in the cloud

### 15.6 Cost Estimate

| Item | One-Time | Recurring |
|---|---|---|
| Apple Developer Account | — | $99/year |
| Google Play Developer Account | $25 | — |
| EAS Build (Expo) | — | Free tier sufficient for small team |
| Development time (10 weeks) | Internal cost | — |
| App Store screenshots/assets | ~$0 (self-generated) | — |

### 15.7 Decision Matrix

| Factor | PWA (Current) | Capacitor Wrapper | React Native (Expo) |
|---|---|---|---|
| **Time to ship** | Already shipped | 1-2 weeks | 8-10 weeks |
| **iOS push notifications** | Unreliable | Native via plugin | Native |
| **Performance** | Good (web) | Okay (WebView) | Excellent (native) |
| **App Store presence** | No | Yes (risky) | Yes |
| **Biometric auth** | No | Yes (plugin) | Yes |
| **Offline support** | Limited | Limited | Full |
| **Code sharing** | 100% | 95%+ | 60-80% |
| **Maintenance burden** | None (existing) | Low | Medium |
| **Long-term scalability** | Limited by web | Limited by WebView | Excellent |
| **User experience quality** | Good | Okay | Excellent |

### 15.8 Recommendation

**Start with React Native (Expo) for the ARL mobile app.** The investment is moderate (8-10 weeks) and the payoff is significant:

1. **Native push notifications** solve the biggest PWA limitation on iOS
2. **Biometric auth** is a quality-of-life win for ARLs checking in frequently
3. **App Store presence** builds credibility and discoverability
4. **Shared TypeScript codebase** minimizes the learning curve and maintenance
5. **Restaurant kiosks stay on the web app** — no migration needed for the hardware installations

**Immediate next step:** Extract shared types, API client, and business logic into a `shared/` directory to prepare for the monorepo structure. This can be done incrementally alongside normal web development.

---

*This audit represents a thorough analysis of the codebase as of February 27, 2026. Recommendations are prioritized by impact and effort. The project is well-built and feature-rich — the suggestions above are refinements and expansions, not fundamental rewrites. Section 14 tracks implementations completed during the audit session. Section 15 explores native mobile app options for future growth.*
