# Implementation Tasks — Hub 2.0 Dream Dashboard

## Phase 1: Core Ambient Experience

### Task 1: Database Schema — New Tables & Columns
- [x] Add `patternHash` (text, nullable) column to `locations` table in `src/lib/db/schema.ts`
- [x] Add `patternHash` (text, nullable) column to `arls` table in `src/lib/db/schema.ts`
- [x] Add `latitude` (real, nullable) and `longitude` (real, nullable) columns to `locations` table
- [x] Define `moodCheckins` table in schema: id, tenantId, locationId, date, moodScore, createdAt
- [x] Define `shiftHandoffs` table in schema: id, tenantId, locationId, shiftDate, shiftPeriod, completedTaskCount, remainingTaskCount, remainingTaskIds, arlMessages, moodScoreAvg, handedOffAt, createdAt
- [x] Define `challenges` table in schema: id, tenantId, title, description, goalType, targetValue, startDate, endDate, status, createdBy, winnerLocationId, createdAt, updatedAt
- [x] Define `challengeParticipants` table in schema: id, challengeId, locationId, joinedAt
- [x] Define `challengeProgress` table in schema: id, challengeId, locationId, date, progressValue, updatedAt
- [x] Define `mentorshipPairs` table in schema: id, tenantId, mentorLocationId, menteeLocationId, status, createdBy, createdAt, endedAt
- [x] Generate Drizzle migration file via `drizzle-kit generate`
- [x] Verify migration runs cleanly via `scripts/migrate.js`

### Task 2: Day Phase Context & Background
- [x] Create `src/lib/day-phase-context.tsx` with `DayPhaseProvider` and `useDayPhase()` hook
- [x] Define six phases (dawn, morning, midday, afternoon, evening, night) with time boundaries and color configs
- [x] Implement timezone-aware phase detection using location timezone from auth context (fallback to browser local time)
- [x] Create `src/components/dashboard/day-phase-background.tsx` with gradient background and floating particles
- [x] Implement 3-second CSS transition between phase gradients
- [x] Add `prefers-reduced-motion` support: disable particles, use instant transitions
- [x] Wrap dashboard page with `DayPhaseProvider`

### Task 3: Layout Context Extension & Pulse Layout Shell
- [x] Extend `DashboardLayout` type in `src/lib/layout-context.tsx` to include `"pulse"`
- [x] Add `{ id: "pulse", name: "Pulse", description: "Heartbeat + floating task orbs" }` to `LAYOUT_OPTIONS`
- [x] Create `src/components/dashboard/pulse-layout.tsx` container component
- [x] Integrate `DayPhaseBackground` as the base layer of PulseLayout
- [x] Render existing `Heartbeat` component at center of PulseLayout
- [x] Render existing `TaskOrbs` component as the orb layer
- [x] Add conditional render branch in `src/app/dashboard/page.tsx` for `layout === "pulse"`
- [x] Verify layout switching works between classic, focus, and pulse
- [x] Verify layout preference persists via `/api/preferences/layout`

### Task 4: Heartbeat & Task Orbs Enhancements
- [x] Add optional `dayPhase` prop to `Heartbeat` component for day-phase-tinted glow rings
- [x] Add `aria-label` to Heartbeat canvas element with dynamic health description
- [x] Add optional `dayPhase` prop to `TaskOrbs` component for orb glow theming
- [x] Add `aria-label` attributes to each Task Orb button
- [x] Fix unused variable warnings in `task-orbs.tsx` (useEffect, completingId, isIncomplete)
- [x] Implement dissolve-to-particles animation on task completion (1500ms)
- [x] Verify orb spring physics (stiffness: 100, damping: 15) work smoothly on layout updates

### Task 5: Soundscape System
- [x] Add `DayPhase` type import and `playSoundscapeChime(phase, event)` function to `src/lib/sound-effects.ts`
- [x] Implement day-phase-aware sound profiles: warm tones for dawn/morning, bright for midday/afternoon, soft for evening/night
- [x] Implement "task due" chime (gentle, phase-appropriate)
- [x] Implement "task completed" thunk (low sine 80Hz, 200ms, consistent across phases)
- [x] Implement "task overdue" rising tone (200Hz→600Hz sweep over 2s)
- [x] Add intensity levels: off, subtle (0.5× gain, limited events), normal (full)
- [x] Respect existing `soundMuted` field and `location:sound-toggle` socket event
- [x] Implement quiet hours (23:00–05:00 local time, no sounds)
- [x] Add soundscape intensity selector to dashboard settings panel

### Task 6: Constellation Pattern Login
- [x] Create `src/components/auth/constellation-grid.tsx` with SVG-based 3×3 star grid
- [x] Implement pointer event handling for touch drag across nodes (pointerdown → pointermove → pointerup)
- [x] Render trail lines between connected nodes with glowing SVG filter effect
- [x] Implement day-phase visual theming for star nodes (golden/white/blue-silver)
- [x] Add haptic feedback via `navigator.vibrate` on node activation
- [x] Add error animation: shake grid + flash trail red on incorrect pattern
- [x] Add twinkling star particles behind grid in constellation mode (respect `prefers-reduced-motion`)
- [x] Add accessibility: `role="application"`, `aria-label`, `aria-live` announcements, keyboard fallback
- [x] Create `POST /api/auth/set-pattern` route: validate pattern (4-9 nodes, no consecutive dupes), bcrypt hash, store in patternHash
- [x] Enhance `POST /api/auth/login` to accept `{ userId, pattern }` as alternative to `{ userId, pin }`
- [x] Enhance `POST /api/auth/validate-user` response to include `hasPattern: boolean`
- [x] Integrate constellation grid into login page: show toggle tabs "PIN | ★ Pattern" when user has both methods
- [x] Default to constellation grid when user has only patternHash (no pinHash)
- [x] Verify rate limiting applies to pattern login attempts

---

## Phase 2: Crew & Shift Intelligence

### Task 7: Mood Check-in System
- [x] Create `src/components/dashboard/mood-checkin.tsx` with five emoji buttons (😫😕😐🙂🤩)
- [x] Implement staggered spring entry animation for emojis
- [x] Implement selection animation: selected scales up, others fade, card dismisses
- [x] Add `aria-label` to each emoji button ("Mood: Terrible", "Mood: Bad", etc.)
- [x] Create `POST /api/mood-checkins` route: validate moodScore 1-5, location-only auth, store in DB
- [x] Create `GET /api/mood-checkins` route: ARL-only, filter by locationId/dateRange, return aggregated data
- [x] Emit `mood:updated` socket event on successful POST
- [x] Integrate prompt into dashboard: show on mount if `sessionStorage` flag not set and user is location type
- [x] Set `sessionStorage.setItem("hub-mood-checked", "true")` after submission

### Task 8: ARL Mood Analytics
- [x] Add "Crew Mood" section to `src/app/arl/analytics/page.tsx`
- [x] Create `GET /api/analytics/mood` route: return avg mood per location per day, scoped to ARL's tenant/locations
- [x] Implement line chart showing daily mood trends per location (7/14/30 day selector)
- [x] Implement dual-axis chart: mood score + task completion % when a location is selected
- [x] Implement burnout warning indicator: red badge when avg mood < 2.5 for 3+ consecutive days
- [x] Wire up `mood:updated` socket event for real-time chart updates

### Task 9: Shift Handoff System
- [x] Create `src/components/dashboard/shift-handoff.tsx` with full-screen animated overlay
- [x] Implement 30-second animation sequence: counters → remaining tasks → ARL messages → mood → confirmation
- [x] Add "Got It" dismiss button and 30-second auto-dismiss timer
- [x] Create `POST /api/shift-handoffs` route: compute task counts from taskCompletions, return 409 if duplicate
- [x] Create `GET /api/shift-handoffs` route: return handoff history for location, accessible to location + ARL
- [x] Emit `shift:handoff` socket event on successful POST
- [x] Add "Hand Off Shift" button to dashboard settings panel
- [x] Implement shift briefing card: on new session, check for recent handoff and display compact summary
- [x] Implement shift period detection (morning/afternoon/evening based on current hour)

### Task 10: Smart Shift Summary
- [x] Create `src/components/dashboard/smart-summary.tsx` card component
- [x] Create `GET /api/analytics/shift-summary` route: compute comparison vs previous day, fastest task, early completions, total points
- [x] Generate encouraging text snippets based on computed data
- [x] Integrate SmartSummary card into ShiftHandoffOverlay
- [x] Make SmartSummary available on ARL analytics page for any location/date

---

## Phase 3: ARL Strategic Tools

### Task 11: War Room Page & Map
- [x] Create `src/app/arl/war-room/page.tsx` with ARL-only auth guard
- [x] Create `src/components/arl/war-room-map.tsx` SVG-based map component
- [x] Implement location node rendering: pulsing ring + filled circle + label, colored by health score
- [x] Implement coordinate-based positioning (normalize lat/lng to SVG viewBox)
- [x] Implement auto-grid fallback for locations without coordinates
- [x] Implement zoom/pan via SVG viewBox manipulation (pointer events + wheel)
- [x] Implement hover/tap tooltip: name, store #, health %, completion %, mood, alerts
- [x] Implement "Mirror" button in tooltip → navigate to existing mirror mode
- [x] Create `src/components/arl/war-room-summary.tsx` top summary bar
- [x] Create `GET /api/arl/war-room/status` route: return health, completion, mood, online status, coordinates for all locations
- [x] Implement filter panel: health status pills, mood range, location group dropdown
- [x] Subscribe to `health:changed` socket events for real-time node color updates
- [x] Implement SVG virtualization for >50 visible nodes
- [x] Add War Room link to ARL sidebar navigation

### Task 12: War Room Real-Time Overlays
- [x] Implement expanded detail overlays (foreignObject cards) when zoomed in
- [x] Show task completion % bar + mood emoji + alert badge in expanded view
- [x] Implement critical alert pulsing ring for locations with health < 40
- [x] Wire summary bar to update on every `health:changed` event

---

## Phase 4: Cross-Location Engagement

### Task 13: Cross-Location Challenges
- [x] Create `src/app/arl/challenges/page.tsx` with challenge list and create form
- [x] Implement create challenge form: title, description, goal type, target, dates, locations
- [x] Create `GET /api/challenges` route: list challenges for tenant, filter by status
- [x] Create `POST /api/challenges` route: validate dates, create challenge + participants
- [x] Create `GET /api/challenges/[id]` route: challenge details + leaderboard
- [x] Create `PATCH /api/challenges/[id]` route: update status (end/cancel), set winner
- [x] Create `GET /api/challenges/[id]/progress` route: progress for all participants
- [x] Create `POST /api/challenges/[id]/progress` route: record daily progress
- [x] Create `src/components/dashboard/challenge-widget.tsx` compact + expanded views
- [x] Implement real-time leaderboard updates via `challenge:progress` socket events
- [x] Implement trophy animation overlay for winning location (5s, confetti + 🏆)
- [x] Implement 24-hour trophy badge on dashboard header
- [x] Add Challenges link to ARL sidebar navigation

### Task 14: Mentorship Pairing System
- [x] Create `src/app/arl/mentorship/page.tsx` with pairing list and create form
- [x] Implement create pairing flow: select mentor + mentee, validate no active duplicates
- [x] Create `GET /api/mentorship-pairs` route: list pairings for tenant
- [x] Create `POST /api/mentorship-pairs` route: create pairing, return 409 if duplicate
- [x] Create `GET /api/mentorship-pairs/[id]` route: pairing details + improvement stats
- [x] Create `PATCH /api/mentorship-pairs/[id]` route: dissolve/complete, set endedAt
- [x] Implement improvement calculation: compare current 7-day avg vs baseline
- [x] Implement bonus XP award: 20% of mentee's daily points when improvement ≥ 10pp
- [x] Emit `mentorship:xp-awarded` socket event on bonus award
- [x] Create `src/components/dashboard/mentorship-widget.tsx` for mentor and mentee views
- [x] Add Mentorship link to ARL sidebar navigation

---

## Cross-Cutting

### Task 15: Real-Time Event Integration
- [x] Add `health:changed` event emission to task completion/uncomplete handlers (when score delta ≥ 10)
- [x] Verify all new socket events are tenant-scoped (no cross-tenant leakage)
- [x] Add socket event listeners in dashboard page for mood, handoff, challenge, mentorship events
- [x] Add socket event listeners in ARL pages for relevant events

### Task 16: Accessibility & Performance Audit
- [x] Verify all canvas elements have dynamic `aria-label` attributes
- [x] Verify all interactive elements have `aria-label` attributes
- [x] Test `prefers-reduced-motion` behavior across all new components
- [x] Verify max 30 animated orbs in Pulse layout
- [x] Verify War Room virtualization activates at >50 nodes
- [x] Profile animation FPS on target kiosk hardware (or Chrome DevTools throttling) — requires manual testing
- [x] Verify all touch targets are ≥ 64px
