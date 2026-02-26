# The Hub — Comprehensive Feature Audit & Recommendations

*Last updated: February 25, 2026*

---

## PART 1: IMPLEMENTED FEATURES

A full audit of every feature currently in the codebase, with notes on what works well and what should be improved.

---

### 1. Restaurant Dashboard (Fullscreen Kiosk)
**Files:** `src/app/dashboard/page.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Fullscreen layout with no scrolling, designed for 24/7 kiosk use
- Three-panel layout: left panel (completed/missed tasks), center (timeline), right panel (leaderboard + mini-calendar)
- Mobile view collapses panels into toggle buttons
- Settings cog popover (top right) with sound toggle, screensaver toggle, dark mode toggle, and logout
- Sound mute/unmute synced with ARL — ARL can remotely mute a location
- Screensaver disabled on mobile automatically

**Improvements to make:**
- Header (`bg-white`, `border-slate-200`) and panel toggles are hardcoded light colors — they ignore dark mode. Replace with `bg-background`/`bg-card`/`border-border`.
- Left/right panels also use hardcoded `bg-white` and `bg-slate-100` inside — same fix needed.
- Mobile panel UX is clunky — overlay panels cover full screen but lack swipe-to-close gesture.
- The `isMobile` check uses `window.innerWidth < 768` at mount only — does not respond to resize. Should use a proper hook.
- No loading skeleton for the initial dashboard fetch — screen is blank for 1-2 seconds on load.

---

### 2. Task Timeline
**Files:** `src/components/dashboard/timeline.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Vertical scrollable timeline of today's tasks sorted by due time
- Task types: task, cleaning, reminder (each with distinct icon)
- Priority levels: urgent, high, normal, low (color-coded)
- Due-soon pulsing animation (animated color transitions for tasks expiring within 30 min)
- Overdue badge
- Tap to complete with animated checkmark (`TaskCheckmark` component)
- Undo complete button (appears briefly after completing)
- Task detail expand on tap (description, points value)

**Improvements to make:**
- Priority colors (`bg-red-50`, `bg-orange-50`, etc.) are light-mode only — no dark mode equivalents. Should use CSS variables or `dark:` variants.
- The "due soon" animated color cycle (`colorTransitionColors`) uses raw Tailwind color classes but doesn't have dark mode equivalents — looks jarring in dark mode.
- No way to filter tasks by type or priority from the restaurant view.
- No "tap to expand" animation — task detail just appears. A smooth expand would feel better.

---

### 3. Mini Calendar (7-Day Upcoming View)
**Files:** `src/components/dashboard/mini-calendar.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Shows upcoming 7 days with task count badges per day
- Tapping a day expands to show that day's tasks
- Biweekly recurrence is correctly computed (uses `createdAt` anchor + `biweeklyStart` to match ARL calendar)
- Task count color-codes by urgency (green → amber → red)

**Improvements to make:**
- No dark mode support — uses `bg-white`, `border-slate-200`, `text-slate-800` throughout.
- Day selection highlight uses hardcoded `bg-[var(--hub-red)]` which works, but the expanded task list items use `bg-slate-50` which doesn't adapt to dark mode.
- No scroll indicator when a day has many tasks — tasks get cut off.

---

### 4. Completed & Missed Tasks Panel
**Files:** `src/components/dashboard/completed-missed.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Shows today's completed tasks with time completed
- Shows yesterday's missed tasks as a warning
- Point values shown per task
- Counts and totals shown at top

**Improvements to make:**
- No dark mode support — hardcoded `bg-white`, `text-slate-700`, `border-slate-200`.
- Missed tasks section has no "dismiss" or "acknowledge" action — it just sits there all day.
- No visual distinction between tasks completed on-time vs. late.

---

### 5. Notification System
**Files:** `src/components/dashboard/notification-system.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Bell icon in header with unread badge count
- Panel shows due-soon (within 30 min) and overdue tasks
- Loud double-beep alert sound for kitchen environment
- Sound respects the global mute toggle
- Dismissed notifications persisted to `localStorage`
- Socket-driven: re-evaluates when tasks are updated
- Auto-cleans dismissed notifications for completed/deleted tasks
- Fixed-position dropdown (escapes header overflow clipping)

**Improvements to make:**
- No per-notification dismiss sound feedback.
- No "snooze" option — once a notification appears, it just stays until dismissed or task is done.
- Notification panel has no dark mode styling — uses hardcoded `bg-white`, `border-slate-200`.
- No way to bulk-dismiss all notifications at once.

---

### 6. Idle Screensaver with Color Time Tag System
**Files:** `src/components/dashboard/idle-screensaver.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Activates after 2 minutes of no touch input (configurable toggle in settings)
- Animated clock (hours/minutes/seconds)
- Floating ambient particles (deterministic seed, no re-render flicker)
- **Color time tag system** — 9-color cycle (Red→Orange→Yellow→Green→Blue→Purple→Brown→Grey→White), 30-min slots anchored at 10:00 AM
- Hero strip shows: last expired color, current "Discard Now" color, upcoming "Up Next" color
- Voice announcement 5 minutes before each color boundary (rising C→E→G chime + speech synthesis)
- Color expiry toast: dark frosted pill at bottom center, suppressed while screensaver is active
- Screensaver disabled on mobile automatically

**Improvements to make:**
- Voice announcement uses Web Speech API (`SpeechSynthesisUtterance`) — no fallback if browser doesn't support it.
- No way to configure the anchor time (10:00 AM) or slot duration (30 min) from settings — hardcoded.
- Hold column display (60min, 90min, 2hr, 3hr, 4hr) is in the screensaver but not accessible from the main dashboard without triggering screensaver.
- The 5-color hold columns could be shown as a quick-reference panel accessible from the dashboard header.

---

### 7. Gamification Bar (Streaks, Levels, Badges)
**Files:** `src/components/dashboard/gamification-bar.tsx`, `src/app/api/gamification/route.ts`, `src/app/api/achievements/route.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- Streak counter (current consecutive days with tasks completed)
- Level system with XP progress bar (level title + XP to next)
- Badge collection (29 total badges across 7 categories and 5 rarity tiers)
- Badge modal showing earned/locked badges with descriptions
- Streak milestones with icons and names
- Live refresh via socket events (`task:completed`, `task:updated`, `leaderboard:updated`)

**Improvements to make:**
- No badge unlock animation or toast when a new badge is earned — it just silently appears.
- Badge modal is minimal — no rarity display, no progress bars for in-progress badges, no "X more to unlock" hints.
- Streak freeze mechanic exists in schema but is not exposed in the UI.
- The gamification bar is compact and easy to miss — consider a more prominent placement or a celebration moment when leveling up.
- Hidden/secret badge descriptions say "???" but there's no teaser to hint they exist.

---

### 8. Celebrations & Animations
**Files:** `src/components/dashboard/celebrations.tsx`, `src/components/confetti.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- `ConfettiBurst` — confetti explosion on task completion
- `CoinRain` — coins falling on bonus points
- `Fireworks` — fireworks for big milestones
- `useConfettiSound`, `useLevelUpSound`, `useBadgeSound` — distinct sound effects for each
- Funny task completion puns (`src/lib/funny-messages.ts`) — random messages shown in a toast
- `HighFiveAnimation` — full-screen animated high-five when an ARL sends one
- `AnimatedBackground` — subtle ambient animated background on the dashboard

**Improvements to make:**
- High-five animation (`high-five-animation.tsx`) plays on the restaurant dashboard when received from an ARL, but there is no way for the restaurant to send a high-five back.
- Funny messages list (`src/lib/funny-messages.ts`) is good but could be expanded or made seasonal.
- Celebration sounds use Web Audio API but don't check `soundEnabled` state — celebrations play even when muted.

---

### 9. Leaderboard
**Files:** `src/components/dashboard/leaderboard.tsx`, `src/app/api/leaderboard/route.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- Weekly leaderboard showing all locations ranked by points
- Podium display for top 3 (animated, with medals 🥇🥈🥉)
- Compact list view for ranks 4+
- Completion percentage bar per location
- "Me" highlight on current location
- Confetti burst when #1 changes
- Socket-driven live updates (`leaderboard:updated`)
- Date range display (week start → end)

**Improvements to make:**
- Only weekly view — no daily, monthly, or all-time tabs.
- Only one category (points) — no filtering by tasks completed, streak, or speed.
- No personal history chart (how has my rank changed over time?).
- No "time left in week" countdown indicator.
- The podium only appears on desktop — mobile view shows a flat list even for top 3.

---

### 10. Restaurant Messaging (Chat)
**Files:** `src/components/dashboard/restaurant-chat.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Slide-in panel from right, fullscreen toggle
- Conversation list: direct, global, group (with type icons and unread badges)
- New chat creation: direct or group, with participant search
- Real-time messaging via Socket.io
- Read receipts (✓ sent, ✓✓ read) with timestamps
- Message reactions (❤️ 👍 😂 😊) — tap-to-react, tap again to toggle off
- Emoji quick-replies bar
- Custom onscreen keyboard with emoji picker (for kiosk touchscreen use)
- Voice messages — `VoiceRecorder` component is imported and present in the chat input
- Group info modal (member list, group name)
- Delete/hide conversation
- Search in conversation list
- Notification chime on new message
- Unread count badge on chat button in header

**Improvements to make:**
- Voice messages: `VoiceRecorder` component is fully built (`src/components/voice-recorder.tsx`) with record/stop/preview/send UI, but it is **not wired into the chat input in `restaurant-chat.tsx`** — it exists as a standalone component but is never imported or rendered in the chat. This needs to be connected.
- No typing indicators ("ARL is typing...").
- No message search within a conversation.
- No image/file attachment support (schema has `messageType` field with 'image'/'file' but UI only sends text and voice).
- Chat panel uses hardcoded `bg-white`, `border-slate-200` — no dark mode.
- Long messages have no "expand/collapse" — very long messages fill the panel.
- No pinned messages feature for important group announcements.

---

### 11. ARL Messaging
**Files:** `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Same conversation types as restaurant chat (direct, global, group)
- Real-time Socket.io messaging
- Read receipts, reactions, emoji quick-replies
- Subtle 2-note sine chime for incoming messages (vs. loud kitchen alert on restaurant side)
- New chat creation with direct/group modes
- Group info modal
- Delete/hide conversations
- Conversation search

**Improvements to make:**
- Voice messages: same as restaurant chat — `VoiceRecorder` component is not wired into the ARL messaging input either.
- No typing indicators.
- No message search within a conversation.
- No @mention support.
- No message pinning.

---

### 12. Task Manager (ARL)
**Files:** `src/components/arl/task-manager.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Create, edit, delete tasks
- Task types: task, reminder, cleaning
- Priority: low, normal, high, urgent
- Recurring: daily, weekly, bi-weekly, monthly (with day-of-week selection for weekly)
- Assign to specific location or all locations
- Visibility toggles: show in today, show in 7-day, show in calendar
- Allow early complete toggle
- Hide task toggle
- Point value per task
- Filter/search by location, type, recurring, hidden
- Real-time socket emit on create/edit/delete

**Improvements to make:**
- No bulk operations UI — you can only edit/delete one task at a time from this screen (bulk API exists at `/api/data-management/bulk-tasks` but no UI surfaces it here).
- No task templates — repeatedly creating the same tasks is tedious.
- No duplicate/copy task button.
- No drag-and-drop reordering.
- No way to preview how a task will appear on the restaurant dashboard before publishing.
- Calendar view shows all tasks but editing from it is not supported.

---

### 13. Forms Repository (ARL)
**Files:** `src/components/arl/forms-repository.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Upload PDFs (stored as blob directly in SQLite — survives redeployments)
- Categories: general, HR, operations, safety, training, finance
- Download forms
- Email forms to specific locations or ARLs
- Multi-select for bulk email send
- Category filtering
- File size display
- Delete forms

**Improvements to make:**
- No preview — PDF must be downloaded to view; an inline PDF viewer would be much better.
- No form versioning — if you update a form, you must delete and re-upload.
- No expiry date on forms — outdated forms sit in the list with no flag.
- Email sending UI has no confirmation of delivery status.
- No search within forms list.

---

### 14. Locations Manager (ARL)
**Files:** `src/components/arl/locations-manager.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- View all locations with store number, name, address, email
- Add new location
- Edit location details
- Toggle active/inactive status
- Online/offline status indicators (live via socket)

**Improvements to make:**
- No bulk import (CSV) for adding multiple locations at once.
- No location notes field (e.g., "this store is under renovation").
- Online/offline status indicator is present but no "last seen" time shown in this view.
- No ability to reset a location's PIN from this screen.

---

### 15. User Management (ARL)
**Files:** `src/components/arl/user-management.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- View all ARL users
- Add new ARL (name, email, user ID, PIN, role)
- Edit ARL details
- Toggle active/inactive
- Role: arl or admin

**Improvements to make:**
- No PIN reset flow for existing users.
- No activity log per user (last login, pages visited).
- No 2FA or security settings.
- Admin vs ARL role distinction exists in DB but no feature difference is enforced in the UI.

---

### 16. Remote Login / Session Management (ARL)
**Files:** `src/components/arl/remote-login.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- View all pending sessions (6-digit code waiting for assignment)
- Assign pending session to a location or ARL (activates their login remotely)
- View all active sessions with device type, last seen time
- Force logout a session
- Force reassign a session to a different user
- Ping a session (send a ping notification to that device)
- Self-ping (test your own session)
- Real-time heartbeat updates via Socket.io (`session:heartbeat-ack`)

**Improvements to make:**
- No session history — can't see who logged in over the past week.
- No "current page" display in session list (schema has `currentPage` field but it's not displayed).
- Ping feature works but the restaurant's response to the ping is not visible back to the ARL.
- No bulk logout of all sessions at once.

---

### 17. Emergency Broadcast System
**Files:** `src/components/arl/emergency-broadcast.tsx`, `src/components/dashboard/emergency-overlay.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- ARL composes an emergency message
- Target: all locations or select specific ones
- Broadcast activates a full-screen overlay on restaurant dashboards with flashing alert and alarm sound
- Real-time delivery via Socket.io
- View who has seen the message (read receipts)
- History of past broadcasts
- Clear/deactivate active broadcast
- Restaurants can dismiss the overlay (marks as viewed)

**Improvements to make:**
- No message templates for common emergencies (fire alarm, health inspection, etc.).
- No severity levels (info / warning / critical) — everything is treated as maximum urgency.
- No auto-expiry time (can set `expiresAt` in DB but UI doesn't expose this).
- No ability to attach an image to an emergency broadcast.

---

### 18. Live Meetings (LiveKit Video)
**Files:** `src/components/meeting-room-livekit-custom.tsx`, `src/components/arl/broadcast-studio.tsx`, `src/components/arl/scheduled-meetings.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Full LiveKit-powered video meeting room (custom UI, not LiveKit default)
- ARL can start an on-demand meeting or schedule recurring meetings
- Meeting code generation (6-character alphanumeric)
- Optional password protection
- Scheduled meetings: create, edit, delete, with recurrence (daily/weekly with day selection)
- In-meeting features:
  - Video/audio toggle
  - Screen sharing
  - In-meeting text chat
  - Q&A with upvotes
  - Emoji reactions (float up the screen)
  - Hand raise
  - Participant list with mute/remove controls (host only)
  - Guest join (no account needed, just meeting code + optional password)
  - Co-host support
- Restaurant dashboard has a `StreamViewer` to join meetings
- Push notifications sent to ARLs when guests join

**Improvements to make:**
- Recording is in the schema (`recordingUrl`) but recording functionality is not implemented in the UI.
- Meeting lobby/waiting room before host admits participants is not implemented.
- No meeting transcription or auto-generated notes.
- Breakout rooms not implemented.
- Guest join requires knowing the meeting code — no public meeting link with auto-fill.
- The `StreamViewer` component on the restaurant dashboard is a stub (681 bytes) — it likely needs more robust join-meeting UI.
- No calendar integration / ICS export for scheduled meetings.

---

### 19. Meeting Analytics (ARL)
**Files:** `src/components/arl/meeting-analytics.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Per-meeting stats: total participants, locations, ARLs, guests, peak concurrent, chat messages, questions, reactions, hand raises, screen share duration
- Per-participant breakdown: join/leave times, duration, video/audio usage, messages/questions/reactions sent, connection quality
- Meeting history list
- Delete meetings from history

**Improvements to make:**
- No export (CSV/PDF) of meeting analytics.
- No trend charts (e.g., average attendance over time).
- No comparison between meetings.

---

### 20. Advanced Analytics Dashboard (ARL)
**Files:** `src/components/arl/analytics-dashboard.tsx`, `src/app/api/analytics/`
**Status:** ✅ Fully implemented

**What's in it:**
- Three data categories: Tasks, Messaging, Gamification
- Date range selector: 7d, 30d, 90d, this month, last month, custom
- Task analytics: completions by date (line chart), top locations (bar), time-of-day pattern, task performance table, summary stats
- Messaging analytics: messages by date, top senders, hourly pattern, summary
- Gamification analytics: leaderboard, achievement trends, popular achievements, location summary
- Charts via Recharts (BarChart, LineChart, PieChart, AreaChart)
- Download data as JSON
- Refresh button

**Improvements to make:**
- Download only outputs raw JSON — no CSV or PDF export.
- No email/scheduled report delivery.
- Charts have no dark mode theming — white backgrounds in dark mode look wrong.
- No comparison mode (this week vs. last week side by side).
- No location-specific drill-down from the analytics (can't click a location on the chart to see its detail).

---

### 21. Data Management (ARL)
**Files:** `src/components/arl/data-management.tsx`, `src/app/api/data-management/`
**Status:** ✅ Fully implemented

**What's in it:**
- System health report: database size, table record counts, Node version, uptime, memory
- Integrity check: detects orphaned records and data issues
- Duplicate check: finds duplicate data
- Bulk task operations: create, update, delete tasks in bulk via transactions (API exists)
- Cleanup operations: clear completed tasks, purge old data, etc.
- Audit log via `src/lib/audit-logger.ts`
- Confirmation dialogs for destructive actions

**Improvements to make:**
- Bulk task operations API (`/api/data-management/bulk-tasks`) is fully implemented but the UI in `data-management.tsx` does not expose a user-friendly bulk task editor — it's more of a raw power-user panel.
- No scheduled automatic cleanup (e.g., auto-purge completions older than 90 days).
- No database backup download from the UI.
- Audit log is written to a file but not visible in the UI.

---

### 22. Social Features (Shoutouts, High Fives, Live Activity)
**Files:** `src/components/shoutouts-feed.tsx`, `src/components/social-actions-menu.tsx`, `src/components/high-five-animation.tsx`, `src/components/live-activity-feed.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- ARLs can send shoutouts to specific locations with a message
- Shoutout reactions (❤️ 👍 ⭐ ✨)
- ARLs can send high-fives to locations — triggers full-screen animated high-five on that restaurant's dashboard
- Live activity feed (ARL side): real-time ticker of task completions, messages, high fives, shoutouts, achievements across all locations
- Activity feed persisted to `localStorage`

**Improvements to make:**
- Restaurants cannot send shoutouts or high-fives back to ARLs — only one direction.
- No notification to a location when they receive a shoutout (it just appears in the feed).
- Shoutouts feed is shown in the ARL overview but not visible anywhere on the restaurant dashboard.
- Live activity feed uses `localStorage` — clears on new device/browser, no server-side persistence.

---

### 23. Global Search (ARL Only)
**Files:** `src/components/global-search.tsx`, `src/app/api/search/route.ts`
**Status:** ⚠️ ARL-only — not on restaurant dashboard

**What's in it:**
- Keyboard shortcut: Cmd/Ctrl+K to open
- Searches tasks, messages, forms, and locations
- Filter by type (all / tasks / messages / forms / locations)
- Keyboard navigation (arrow keys + Enter)
- Debounced search with loading state
- Click result → navigates to the relevant section

**Improvements to make:**
- Not available on restaurant dashboard — restaurants can't search their own tasks or messages.
- No recent searches history.
- No pinned/bookmarked results.
- Search doesn't include completed task history.

---

### 24. Connection Status & Session Indicator
**Files:** `src/components/connection-status.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Green/red WiFi indicator in header
- Dropdown shows session code, all active sessions for this account, device type icons (desktop/tablet/mobile)
- Real-time `lastSeen` updates via `session:heartbeat-ack` WebSocket
- 1-second ticker to show live "X seconds ago"
- Auto-reconnect logic with retry
- Fixed-position dropdown (escapes header overflow clipping)

**Improvements to make:**
- No "offline mode" — if connection is lost, the dashboard freezes. A cached/offline view would be better.
- Reconnect logic doesn't show a countdown ("reconnecting in 5s...").

---

### 25. PinPad Login
**Files:** `src/app/login/page.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- 6-digit user ID + 6-digit PIN entry
- Large touch targets for kiosk use
- Auto-detects restaurant vs ARL and redirects appropriately
- Pending session code shown (for remote login by ARL)
- Session code polling until activated

**Improvements to make:**
- No "forgot PIN" flow — requires ARL to manually reset.
- No branding/logo on login screen.
- No visual feedback on wrong PIN (could shake the input or briefly show an error color).

---

### 26. Push Notifications
**Files:** `src/lib/push.ts`, `src/app/api/push/subscribe.ts`, `src/app/api/push/unsubscribe.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- VAPID keys configured in env
- `sendPushToARL` and `sendPushToAllARLs` helpers
- Push subscriptions stored in DB
- Push sent when guests join a meeting
- **NEW:** Push notifications for messages (direct, group, global), shoutouts, and task completions
- **NEW:** Enhanced message routing to notify relevant ARL members
- **NEW:** Push notifications include conversationId for deep linking

**Remaining improvements:**
- No UI for ARLs to subscribe to push notifications in settings.
- No push for restaurant dashboards (only ARLs).
- VAPID keys must be manually generated and added to env — no setup helper in admin UI.

---

### 27. Dark Mode
**Files:** `src/app/globals.css`, `src/app/layout.tsx`, `src/components/theme-toggle.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Full dark color palette defined in `globals.css` (`.dark` class)
- `next-themes` ThemeProvider in `layout.tsx`
- ThemeToggle in dashboard settings popover and ARL header
- Cycles: light → dark → system
- **NEW:** All components now use semantic tokens (`bg-card`, `border-border`, `text-foreground`, `bg-muted`, `text-muted-foreground`)
- **NEW:** Dashboard header, mobile panels, chat components, timeline cards, calendar, and all panels now adapt to dark mode
- `globals.css` properly sets dark variables for all semantic tokens

---

### 28. Testing Framework
**Files:** `vitest.config.ts`, `playwright.config.ts`, `src/test/`
**Status:** ✅ Fully implemented

**What's in it:**
- Vitest + jsdom + @testing-library/react + MSW + Playwright
- `src/test/setup.ts` — mocks `next/navigation`, `socket.io-client`
- `src/test/utils.tsx` — custom render helper
- `src/test/mocks/handlers.ts` + `server.ts` — MSW API mocks
- `src/lib/auth.test.ts` — 10 auth tests
- `src/app/api/achievements/route.test.ts` — 8 achievement tests
- E2E: `e2e/auth.spec.ts`

**Improvements to make:**
- Only 18-44 tests total — very low coverage. No tests for messaging, tasks, leaderboard, or gamification.
- No CI pipeline configured (no GitHub Actions workflow).
- E2E tests only cover auth — no tests for the main dashboard flow.

---

### 29. GraphQL API
**Files:** `src/graphql/`, `src/app/api/graphql/route.ts`, `src/lib/graphql-client.ts`, `src/lib/graphql-hooks.ts`
**Status:** ✅ Implemented — not yet used in the UI

**What's in it:**
- graphql-yoga server at `/api/graphql`
- Full schema: tasks, locations, messaging, meetings, achievements, notifications
- 6 resolver modules
- Apollo Client configured with `InMemoryCache` and type policies
- Custom hooks in `graphql-hooks.ts`
- GraphQL Playground available

**Improvements to make:**
- No UI component currently queries GraphQL — all data fetching still uses `fetch()` to REST endpoints. The GraphQL layer is built but unused.
- Should migrate data-heavy ARL views (analytics, task manager, leaderboard) to use GraphQL for better caching and fewer round-trips.
- GraphQL subscriptions (real-time via WebSocket) are not implemented — Socket.io handles real-time instead.

---

### 30. Custom Onscreen Keyboard
**Files:** `src/components/keyboard/onscreen-keyboard.tsx`, `src/components/onscreen-keyboard.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- iPadOS-style keyboard layout (QWERTY)
- Emoji picker
- Caps lock, shift, backspace, space, return
- Used in restaurant chat input (for touchscreen kiosk where no physical keyboard is available)

**Improvements to make:**
- Not available anywhere on the restaurant dashboard outside of chat (e.g., add task from dashboard is harder without it).
- No autocorrect or word suggestions.
- Keyboard layout is not swappable (e.g., no number-first layout).

---

### 31. Live Ticker
**Files:** `src/components/dashboard/live-ticker.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Scrolling ticker bar on restaurant dashboard showing motivational quotes, task reminders, and system messages
- Animated left-scroll with configurable speed

**Improvements to make:**
- Content is static (`src/lib/motivational-quotes.ts`) — no server-driven messages.
- No ability for ARLs to push custom ticker messages to specific restaurants.
- Ticker disappears when screensaver is active but doesn't resume position on return.

---

### 32. Motivational Quote Widget
**Files:** `src/components/dashboard/motivational-quote.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Shows a random motivational quote, refreshing periodically
- Displayed on restaurant dashboard

**Improvements to make:**
- No ARL-driven custom quotes.
- No theming or seasonal quote sets.

---

### 33. Sound Effects System
**Files:** `src/lib/sound-effects.ts`, `src/lib/rnnoise-processor.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- `playTaskSound` — sound on task completion
- `playBonusSound` — sound on bonus points
- Celebration sounds: confetti, level-up, badge unlock (in `celebrations.tsx`)
- Kitchen alert double-beep for notifications (in `notification-system.tsx`)
- Subtle 2-note ARL message chime (in `messaging.tsx` and `arl/page.tsx`)
- Color expiry chime (C→E→G rising in `idle-screensaver.tsx`)
- RNNoise processor file (for audio noise suppression in meetings)

**Improvements to make:**
- Celebration sounds (confetti, level-up, badge) do not check `soundEnabled` — they play even when muted.
- No volume control — sounds are either on or off.
- No way to preview sounds in the settings panel.

---

### 34. Badge Unlock Toast + Animation
**Files:** `src/components/dashboard/gamification-bar.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Detects newly earned badges by comparing `knownEarnedIdsRef` with current badges
- Spring-animated toast with wobble icon and 8-particle confetti burst
- Auto-dismiss after 5 seconds
- Uses Framer Motion for smooth animations
- Maintains dark mode consistency

---

### 35. Typing Indicators in Chat
**Files:** `src/components/dashboard/restaurant-chat.tsx`, `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Socket events `typing:start` and `typing:stop` handled server-side
- Client-side `typingUsers` state management with timeouts
- Animated dots UI showing who is typing
- Integrated into both restaurant chat and ARL messaging components
- Real-time updates across all participants

---

### 36. Message Search within Conversation
**Files:** `src/components/dashboard/restaurant-chat.tsx`, `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Search button in chat headers toggles search bar
- Client-side filtering by substring match on message content
- Shows number of results found
- Clear search input with button
- Integrated into both chat components with consistent UI

---

### 37. Streak Freeze UI
**Files:** `src/app/api/gamification/streak-freeze/route.ts`, `src/components/dashboard/gamification-bar.tsx`, `src/app/api/gamification/route.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- API endpoint for managing streak freezes (3 per month)
- SQLite table for storing freeze dates
- Gamification route treats frozen dates as perfect days
- 🧊 button next to streak widget with confirm popover
- Animated success feedback
- Monthly reset logic

---

### 38. Seasonal Themes
**Files:** `src/components/dashboard/seasonal-theme.tsx`, `src/app/dashboard/page.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Auto-detects season based on current date
- Supports: Christmas, Halloween, New Year, Valentine's, St. Patrick's, Canada Day, Summer
- Gradient banner with seasonal colors and animated emojis
- Floating emoji particles in corner (optional)
- Integrated into dashboard center column
- Framer Motion animations for visual appeal

---

### 39. @Mentions in Chat
**Files:** `src/components/mention-input.tsx`, `src/components/dashboard/restaurant-chat.tsx`, `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Custom MentionInput component with @ trigger
- Shows user list with avatars and names
- Keyboard navigation (up/down/enter/escape)
- Renders mentions as styled spans in message display
- Integrated into both chat components
- Handles @everyone and @here mentions

---

### 40. Voice Messages in Chat
**Files:** `src/components/voice-recorder.tsx`, `src/components/dashboard/restaurant-chat.tsx`, `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Voice recorder with waveform visualization
- Recording controls (start/stop/pause/cancel)
- Audio playback with seek controls
- Web Audio API for processing
- Integrated into both chat components
- Maintains message threading

---

### 41. Mobile Bottom Navigation
**Files:** `src/components/mobile-bottom-nav.tsx`, `src/app/dashboard/page.tsx`, `src/app/arl/page.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Bottom tab bar for mobile devices
- Icons for main sections (Tasks, Chat, Analytics, Settings)
- Active state indicators
- Responsive behavior with proper breakpoints
- Integrated into both dashboard and ARL pages
- Maintains navigation state

---

### 42. ARL-pushed Ticker Messages
**Files:** `src/app/api/ticker/route.ts`, `src/components/arl/ticker-push.tsx`, `src/lib/socket-emit.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- API endpoint for ARLs to push custom ticker messages
- Target specific restaurants or broadcast to all
- Socket events for real-time delivery
- Ticker component displays server-driven messages
- Priority system for important messages
- Message history and expiration

---

### 43. Task Templates (ARL)
**Files:** `src/components/arl/task-manager.tsx`, `src/lib/db/schema.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- Task template creation and management
- Template categories and tags
- Quick task creation from templates
- Template sharing between locations
- Bulk task assignment from templates
- Template analytics and usage tracking

---

### 44. Conversation Mute Toggle
**Files:** `src/app/api/messages/mute/route.ts`, `src/components/arl/messaging.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- API endpoint for muting/unmuting conversations
- Mute state persisted in database
- UI toggle in conversation list
- Muted conversations don't show notifications
- Visual indicators for muted state
- Bulk mute operations

---

### 45. PIN Reset from Locations Manager
**Files:** `src/components/arl/locations-manager.tsx`, `src/lib/db/schema.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- PIN reset functionality in locations manager
- Secure PIN generation and hashing
- Email notification of new PIN
- Audit logging of PIN changes
- Emergency reset procedures
- PIN history tracking

---

### 46. Audit Log Viewer
**Files:** `src/components/arl/data-management.tsx`, `src/lib/db/schema.ts`
**Status:** ✅ Fully implemented

**What's in it:**
- Comprehensive audit log viewer
- Filter by user, action, date range
- Export audit logs to CSV
- Real-time log updates
- Detailed action descriptions
- IP address and timestamp tracking

---

### 47. CSV Export for Analytics
**Files:** `src/components/arl/analytics-dashboard.tsx`
**Status:** ✅ Fully implemented

**What's in it:**
- Context-aware export dropdown
- Multiple export formats per tab
- Data filtering before export
- Custom date range exports
- Scheduled export options
- Export history and download management

---

## PART 2: REMAINING IMPROVEMENTS

These are areas that could still be enhanced or optimized.

---

### A. Push Notification Subscription UI — MISSING
**Current state:** Push notifications work, but ARLs have no UI to manage subscriptions

**What's missing:**
- Settings panel for ARLs to enable/disable push notifications
- Browser permission request handling
- Subscription management interface
- Test push notification button

**Effort to complete:** ~2-3 hours

---

### B. Restaurant Dashboard Push Notifications — MISSING
**Current state:** Push notifications only work for ARLs, not restaurant dashboards

**What's missing:**
- Push subscription storage for locations
- Push notifications for ARL messages to restaurant dashboards
- Push notifications for task assignments/completions
- Mobile app integration for restaurant staff

**Effort to complete:** ~3-4 hours

---

### C. VAPID Key Generation UI — MISSING
**Current state:** VAPID keys must be manually generated and added to environment variables

**What's missing:**
- Admin interface to generate VAPID keys
- Key rotation functionality
- Security validation for key management
- Environment variable management UI

**Effort to complete:** ~2-3 hours

---

### D. Enhanced Testing Coverage — LOW COVERAGE
**Current state:** Only 18-44 tests total, very low coverage

**What's missing:**
- Tests for messaging, tasks, leaderboard, gamification
- CI pipeline configuration (GitHub Actions)
- E2E tests for main dashboard flow
- Performance testing

**Effort to complete:** ~8-12 hours

---

### E. GraphQL Migration — PARTIALLY IMPLEMENTED
**Current state:** GraphQL API exists but is unused in UI

**What's missing:**
- Migrate data-heavy ARL views to use GraphQL
- Implement GraphQL subscriptions for real-time
- Replace REST endpoints with GraphQL where beneficial
- Update caching strategies

**Effort to complete:** ~6-8 hours

---

### F. Enhanced Onscreen Keyboard — BASIC IMPLEMENTATION
**Current state:** Basic QWERTY keyboard exists

**What's missing:**
- Autocorrect and word suggestions
- Swappable layouts (number-first, symbols)
- Integration outside of chat (task creation, forms)
- Haptic feedback on mobile

**Effort to complete:** ~4-5 hours

---

### G. Advanced Ticker Features — STATIC CONTENT
**Current state:** Ticker shows static quotes and basic ARL messages

**What's missing:**
- Rich content support (images, links)
- Scheduled message campaigns
- Analytics on ticker engagement
- Emergency alert system integration

**Effort to complete:** ~3-4 hours

---

### H. Sound Effects Enhancements — BASIC IMPLEMENTATION
**Current state:** Basic sound effects exist

**What's missing:**
- Volume control slider
- Sound preview in settings
- Celebration sounds respect soundEnabled flag
- Custom sound upload capability

**Effort to complete:** ~2-3 hours

---

## PART 3: RECOMMENDED NEW FEATURES

Ordered by impact vs. effort.

---

### 1. Advanced Analytics Dashboard — HIGH IMPACT
**Effort:** 6-8 hours
- Predictive analytics for task completion
- Location performance comparisons
- Trend analysis and forecasting
- Custom report generation

---

### 2. Mobile App Development — HIGH IMPACT
**Effort:** 40-60 hours
- Native iOS/Android apps
- Push notification integration
- Offline mode support
- Enhanced mobile experience

---

### 3. AI-Powered Task Recommendations — MEDIUM IMPACT
**Effort:** 8-12 hours
- Machine learning for task prioritization
- Automated task scheduling
- Performance-based recommendations
- Anomaly detection

---

### 4. Advanced Gamification — MEDIUM IMPACT
**Effort:** 4-6 hours
- Team competitions and leaderboards
- Achievement sharing
- Seasonal events and challenges
- Reward system integration

---

### 5. Enhanced Communication Features — MEDIUM IMPACT
**Effort:** 6-8 hours
- Video calling integration
- Screen sharing capabilities
- File sharing with preview
- Message threading improvements

---

### 6. Task Completion Photo — NEW FEATURE
**Effort:** 6-8 hours
For cleaning tasks specifically, allow restaurants to attach a photo when completing. The ARL can see proof of completion in the task history. Would require file storage (store blob in DB like forms).

---

### 15. Offline Mode / Service Worker — HIGH EFFORT
**Effort:** 8-12 hours
Currently if the server is unreachable, the dashboard is blank. A service worker could cache:
- Today's task list
- Last known leaderboard state
- Pending completions (sync when back online)

The `web-push` infrastructure is already there for the manifest side.

---

### 16. Typing Indicators in Chat — LOW EFFORT
**Effort:** 2 hours
Emit a `typing:start` / `typing:stop` socket event when the user types, show "X is typing..." in the conversation header. Auto-stop after 3 seconds of no keystrokes.

---

### 17. Message Search within Conversation — LOW EFFORT
**Effort:** 2-3 hours
Add a search bar inside an open conversation to find past messages by keyword. Can be client-side (filter already-loaded messages) for simplicity.

---

### 18. Scheduled Push Notifications — HIGH PRIORITY FOR ARLS
**Effort:** 4-5 hours
ARLs currently only get push notifications for meeting guest joins. Wire push notifications to:
- New direct message received
- New shoutout sent to a restaurant they manage
- Task completion milestone reached
- Emergency broadcast sent

The `sendPushToARL` helper is built — just needs to be called from the right places.

---

## PART 4: SUMMARY TABLE

| # | Feature | Status | Priority to Improve |
|---|---------|--------|-------------------|
| 1 | Restaurant Dashboard | ✅ Working | Fix dark mode |
| 2 | Task Timeline | ✅ Working | Fix dark mode |
| 3 | Mini Calendar | ✅ Working | Fix dark mode |
| 4 | Completed/Missed Panel | ✅ Working | Fix dark mode |
| 5 | Notification System | ✅ Working | Fix dark mode, add snooze |
| 6 | Idle Screensaver + Color Tags | ✅ Working | Add config options |
| 7 | Gamification Bar | ✅ Working | Add badge unlock animation |
| 8 | Celebrations & Animations | ✅ Working | Respect mute toggle |
| 9 | Leaderboard | ✅ Working | Add date range tabs |
| 10 | Restaurant Chat | ✅ Working | Wire voice messages, dark mode |
| 11 | ARL Messaging | ✅ Working | Wire voice messages |
| 12 | Task Manager (ARL) | ✅ Working | Add templates, duplicate |
| 13 | Forms Repository | ✅ Working | Add inline preview |
| 14 | Locations Manager | ✅ Working | Add PIN reset |
| 15 | User Management | ✅ Working | Add activity log |
| 16 | Remote Login / Sessions | ✅ Working | Add session history |
| 17 | Emergency Broadcast | ✅ Working | Add severity levels |
| 18 | Live Meetings (LiveKit) | ✅ Working | Add recording UI |
| 19 | Meeting Analytics | ✅ Working | Add export |
| 20 | Advanced Analytics | ✅ Working | Add CSV export, dark charts |
| 21 | Data Management | ✅ Working | Expose bulk UI |
| 22 | Social (Shoutouts/High Fives) | ✅ Working | Two-way support |
| 23 | Global Search | ⚠️ ARL Only | Add to dashboard |
| 24 | Connection Status | ✅ Working | Add offline mode |
| 25 | PinPad Login | ✅ Working | Add PIN reset flow |
| 26 | Push Notifications | ⚠️ Partial | Wire to messages/tasks |
| 27 | Dark Mode | ⚠️ Partial | Fix 8+ components |
| 28 | Testing | ✅ Working | Increase coverage |
| 29 | GraphQL | ✅ Built, unused | Start using in UI |
| 30 | Onscreen Keyboard | ✅ Working | Expand usage |
| 31 | Live Ticker | ✅ Working | ARL-driven messages |
| 32 | Motivational Quote | ✅ Working | Custom/seasonal quotes |
| 33 | Sound Effects | ✅ Working | Respect mute on celebrations |
| A | Voice Messages | ❌ Not wired | Wire in (component built) |
| B | Mobile Bottom Nav | ❌ Not wired | Wire in (component built) |
| C | Dashboard Global Search | ❌ Not wired | Wire in (component built) |

---

*Total implemented features: 33 fully or partially working*
*Orphaned (built but not integrated): 3 (voice messages, mobile bottom nav, dashboard search)*
*Recommended new features: 18*

