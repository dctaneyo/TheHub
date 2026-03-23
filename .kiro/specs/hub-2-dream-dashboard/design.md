# Design Document — Hub 2.0 Dream Dashboard

## Overview

This document defines the technical architecture for transforming The Hub from a utilitarian franchise management dashboard into a living, ambient experience. The design spans 18 requirements across four phases, integrating with the existing Next.js 16 / TypeScript / TailwindCSS v4 / Drizzle ORM / Socket.IO / Framer Motion stack.

The guiding design philosophy: **the dashboard should feel like a living organism, not a spreadsheet.** Every pixel breathes, every interaction has weight, and the environment itself communicates state.

---

## Architecture Principles

1. **Additive, not destructive** — All new features extend existing components and patterns. The Classic and Focus layouts remain untouched. The Pulse layout is a new peer.
2. **Canvas for ambient, DOM for interaction** — Heartbeat and particle systems use `<canvas>` for performance. Interactive elements (orbs, cards, buttons) stay in the DOM for accessibility and touch handling.
3. **Sound is synthesized, not sampled** — All audio uses Web Audio API oscillators. Zero external audio files. Keeps the bundle tiny and allows real-time parameter tweaking per day phase.
4. **Real-time by default** — Every new data flow integrates with the existing Socket.IO infrastructure. No polling.
5. **Kiosk-first** — Touch targets ≥ 64px. Animations GPU-accelerated. Max 30 simultaneous animated orbs. All features work without a keyboard.

---

## System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENT (Browser)                         │
│                                                                 │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐  ┌───────────────┐  │
│  │ Login    │  │Dashboard │  │ ARL      │  │ War Room      │  │
│  │ Page     │  │ Page     │  │ Dashboard│  │ /arl/war-room │  │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘  └───────┬───────┘  │
│       │              │              │                │          │
│  ┌────▼─────┐  ┌────▼──────────────▼────────────────▼───────┐  │
│  │Constella-│  │              Context Layer                  │  │
│  │tion Grid │  │  AuthCtx · SocketCtx · LayoutCtx · DayPhase│  │
│  └──────────┘  └────────────────┬───────────────────────────┘  │
│                                 │                               │
│  ┌──────────────────────────────▼───────────────────────────┐  │
│  │                   Component Layer                         │  │
│  │  Heartbeat · TaskOrbs · DayPhaseBackground · Soundscape  │  │
│  │  MoodCheckin · ShiftHandoff · SmartSummary · Challenges   │  │
│  │  MentorshipWidget · ConstellationGrid · WarRoomMap        │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                 │
└─────────────────────────┬───────────────────────────────────────┘
                          │ HTTP + WebSocket
┌─────────────────────────▼───────────────────────────────────────┐
│                        SERVER (Next.js)                         │
│                                                                 │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                    API Routes                             │  │
│  │  /api/auth/login (enhanced) · /api/auth/set-pattern      │  │
│  │  /api/mood-checkins · /api/shift-handoffs                 │  │
│  │  /api/analytics/mood · /api/analytics/shift-summary       │  │
│  │  /api/challenges · /api/challenges/[id]/progress          │  │
│  │  /api/mentorship-pairs · /api/arl/war-room/status         │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │              Socket.IO Event Layer                        │  │
│  │  mood:updated · shift:handoff · challenge:progress        │  │
│  │  mentorship:xp-awarded · health:changed                   │  │
│  └──────────────────────────┬───────────────────────────────┘  │
│                              │                                  │
│  ┌──────────────────────────▼───────────────────────────────┐  │
│  │           Drizzle ORM + better-sqlite3                    │  │
│  │  Existing tables + 6 new tables + 3 new columns          │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Phase 1: Core Ambient Experience

### 1A. Constellation Pattern Login

#### Component: `ConstellationGrid`
- **File**: `src/components/auth/constellation-grid.tsx`
- **Type**: Client component (`"use client"`)
- **Rendering**: SVG-based 3×3 grid with `<circle>` nodes and `<line>` trail connections
- **Why SVG over Canvas**: The grid is interactive (touch targets need DOM hit testing), has only 9 nodes (no performance concern), and SVG scales perfectly on retina kiosk displays

#### Grid Layout
```
  [0] ─── [1] ─── [2]
   │  ╲    │    ╱  │
   │    ╲  │  ╱    │
  [3] ─── [4] ─── [5]
   │    ╱  │  ╲    │
   │  ╱    │    ╲  │
  [6] ─── [7] ─── [8]
```

Each node is a 64×64px touch target. The visible star is 24px with a glowing halo. Grid total: ~280×280px centered in the login card.

#### Interaction Model
1. User touches any node → that node activates (glows, scales up, haptic pulse)
2. User drags finger → as the touch point enters another node's hit area, that node activates and a trail line connects them
3. Intermediate nodes along the drag path are NOT auto-collected (unlike Android pattern lock) — only explicitly touched nodes count
4. On `pointerup`, the sequence is submitted
5. Minimum 4 nodes, maximum 9, no repeated consecutive nodes

#### Visual Theming (Day Phase Integration)
The constellation grid adapts to the ambient day phase even on the login screen:
- **Dawn/Morning**: Warm golden stars (`#fbbf24`), soft amber trail glow, faint sunrise gradient behind grid
- **Midday/Afternoon**: Bright white stars (`#f8fafc`), clean white trail, minimal background
- **Evening/Night**: Cool blue-silver stars (`#93c5fd`), ethereal blue trail glow, deep navy background with twinkling particle field

The login page determines day phase using the browser's local time (no location timezone needed pre-auth).

#### Trail Rendering
- SVG `<line>` elements between connected node centers
- `stroke-linecap: round`, stroke width 4px
- Animated glow via SVG `<filter>` with `feGaussianBlur` (sigma: 3) + `feComposite`
- Trail color matches the day-phase star color with 80% opacity
- On error: trail flashes `#ef4444` for 400ms, then clears

#### Authentication Flow
```
Login Page
  ├─ Step 1: Enter 4-digit User ID (existing numpad)
  ├─ Step 2a: PIN entry (existing, default if user has pinHash only)
  └─ Step 2b: Constellation pattern (if user has patternHash)
      ├─ If user has BOTH: show toggle tabs "PIN | ★ Pattern"
      └─ If user has ONLY pattern: auto-show constellation grid
```

#### API Changes
- `POST /api/auth/login`: Add optional `pattern: number[]` field. If present, hash with bcrypt and compare against `patternHash`. Existing `pin` flow unchanged.
- `POST /api/auth/set-pattern`: New route. Requires auth. Accepts `{ pattern: number[] }`. Validates length 4-9, no consecutive duplicates. Hashes with bcrypt (salt rounds: 10). Stores in `locations.patternHash` or `arls.patternHash`.
- `POST /api/auth/validate-user`: Response adds `hasPattern: boolean` so the login page knows which auth mode to show.

#### Security
- Pattern is converted to a string (e.g., `[0,1,2,5,8]` → `"01258"`) before bcrypt hashing — same security model as the 4-digit PIN
- Rate limiting applies identically to pattern attempts (existing `checkRateLimit`)
- Minimum 4 nodes provides 3024 possible patterns (P(9,4) = 3024), comparable to a 4-digit PIN (10,000 combinations). Users choosing 5+ nodes get significantly more entropy.

#### Accessibility
- Grid container: `role="application"`, `aria-label="Draw a pattern across the stars to log in"`
- Each node: `role="button"`, `aria-label="Star node {position}"` (e.g., "Star node top-left")
- On node activation: `aria-live="polite"` region announces "Node {n} connected"
- Keyboard fallback: nodes are focusable, Space/Enter toggles selection, Tab navigates grid

---

### 1B. Heartbeat Visualization Engine

#### Existing Component Extension
- **File**: `src/components/dashboard/heartbeat.tsx` (already exists)
- **Changes**: Minimal. The existing component already implements all Req 1 acceptance criteria. Extensions needed:
  - Add optional `dayPhase` prop to tint the glow rings with day-phase colors
  - Add `aria-label` with dynamic health description

#### Health Score Formula
```typescript
const healthScore = Math.max(0, Math.min(100, 100 - (overdueCount * 15) - (dueSoonCount * 5)));
```
Computed in the dashboard page and passed as the `health` prop. No server-side computation needed — the dashboard already has overdue/due-soon counts from the tasks API.

---

### 1C. Spatial Task Orbs (Pulse Layout)

#### Existing Component Extension
- **File**: `src/components/dashboard/task-orbs.tsx` (already exists)
- **Changes**: Add optional `dayPhase` prop for orb glow theming. Fix unused variable warnings.

#### New Component: `PulseLayout`
- **File**: `src/components/dashboard/pulse-layout.tsx`
- **Type**: Client component
- **Structure**:
```tsx
<div className="relative w-full h-full">
  <DayPhaseBackground phase={currentPhase} />
  <div className="absolute inset-0 flex items-center justify-center">
    <Heartbeat health={healthScore} large ... />
  </div>
  <TaskOrbs tasks={tasks} currentTime={time} ... />
</div>
```

#### Layout Context Extension
- **File**: `src/lib/layout-context.tsx`
- **Change**: Add `"pulse"` to `DashboardLayout` union type and `LAYOUT_OPTIONS` array
- **Dashboard integration**: In `src/app/dashboard/page.tsx`, add a conditional render branch for `layout === "pulse"` that renders `<PulseLayout>` instead of Classic/Focus

---

### 1D. Ambient Day Phases

#### New Context: `DayPhaseProvider`
- **File**: `src/lib/day-phase-context.tsx`
- **Type**: Client context provider
- **Exports**: `useDayPhase()` → `{ phase, colors, isTransitioning }`

#### Phase Definitions
```typescript
type DayPhase = "dawn" | "morning" | "midday" | "afternoon" | "evening" | "night";

const PHASE_CONFIG: Record<DayPhase, { hours: [number, number]; gradient: string; particleColor: string }> = {
  dawn:      { hours: [5, 8],   gradient: "from-rose-200 via-orange-100 to-amber-50",     particleColor: "#fbbf24" },
  morning:   { hours: [8, 11],  gradient: "from-sky-200 via-blue-50 to-white",             particleColor: "#38bdf8" },
  midday:    { hours: [11, 14], gradient: "from-amber-100 via-yellow-50 to-white",         particleColor: "#fcd34d" },
  afternoon: { hours: [14, 17], gradient: "from-amber-200 via-orange-100 to-rose-50",      particleColor: "#fb923c" },
  evening:   { hours: [17, 20], gradient: "from-indigo-400 via-purple-300 to-blue-200",    particleColor: "#a78bfa" },
  night:     { hours: [20, 5],  gradient: "from-slate-900 via-indigo-950 to-slate-800",    particleColor: "#475569" },
};
```

#### Background Component: `DayPhaseBackground`
- **File**: `src/components/dashboard/day-phase-background.tsx`
- **Rendering**: Full-viewport `<div>` at z-index 0 with Tailwind gradient classes
- **Particles**: 20-40 small `<motion.div>` elements with randomized float animations
- **Transitions**: CSS `transition-all duration-[3000ms]` on the gradient container
- **Timezone**: Uses location timezone from auth context (falls back to browser local time)
- **Performance**: `will-change: background` on the gradient div. Particles use `transform` only (GPU-composited). `prefers-reduced-motion` disables particles entirely.

---

### 1E. Ambient Soundscape System

#### Extension of Existing Module
- **File**: `src/lib/sound-effects.ts` (extend, don't replace)
- **New exports**: `playSoundscapeChime(phase, event)`, `SoundscapeEvent` type

#### Sound Design (All Web Audio API Synthesized)

| Event | Dawn/Morning | Midday/Afternoon | Evening/Night |
|-------|-------------|-------------------|---------------|
| Task due | Warm sine chime (C4→E4) | Bright triangle chime (E5→G5) | Soft sine bell (G3→B3) |
| Task completed | Low "thunk" (sine 80Hz, 200ms) | Same across all phases | Same across all phases |
| Task overdue | Rising sine sweep 200Hz→600Hz over 2s | Same but triangle wave | Same but quieter (gain 0.08) |

#### Intensity Levels
- **Off**: No sounds
- **Subtle**: Gain multiplier 0.5×, only completion and overdue sounds
- **Normal**: Full gain, all event sounds

#### Configuration
- Stored per-location via existing `soundMuted` field + new intensity preference in `sessionStorage`
- Settings UI: small dropdown in the existing dashboard settings panel (gear icon)
- Quiet hours: 23:00–05:00 local time — no sounds regardless of setting

---

## Phase 2: Crew & Shift Intelligence

### 2A. Crew Mood Check-in System

#### Component: `MoodCheckinPrompt`
- **File**: `src/components/dashboard/mood-checkin.tsx`
- **Type**: Client component, rendered as a modal overlay on the dashboard
- **Trigger**: On dashboard mount, if `sessionStorage.getItem("hub-mood-checked")` is falsy AND user is a location (not ARL)
- **UI**: Five large emoji buttons (80×80px touch targets) in a horizontal row, centered in a frosted-glass card
- **Animation**: Emojis enter with staggered spring animations. On tap, selected emoji scales up, others fade, card dismisses with a satisfying slide-down

#### Emoji Scale
```
😫 (1)  😕 (2)  😐 (3)  🙂 (4)  🤩 (5)
```

#### API: `POST /api/mood-checkins`
```typescript
// Request
{ moodScore: number } // 1-5

// Response
{ ok: true, id: string }

// Validation: moodScore must be integer 1-5
// Auth: location users only (reject ARL with 403)
// Derives tenantId and locationId from auth token
```

#### API: `GET /api/mood-checkins`
```typescript
// Query params: ?locationId=xxx&startDate=2026-01-01&endDate=2026-01-31
// Auth: ARL only
// Returns: { checkins: { date: string, locationId: string, moodScore: number, count: number }[] }
// Aggregated: average mood per location per day
```

#### Database Table
```sql
CREATE TABLE mood_checkins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  date TEXT NOT NULL,           -- YYYY-MM-DD
  mood_score INTEGER NOT NULL,  -- 1-5
  created_at TEXT NOT NULL
);
```

#### Socket Event
On successful POST, server emits `mood:updated` to all ARL sockets in the same tenant:
```typescript
{ locationId: string, date: string, avgMoodScore: number }
```

---

### 2B. ARL Mood Analytics

#### Integration Point
- **File**: `src/app/arl/analytics/page.tsx` (extend existing analytics page)
- **New section**: "Crew Mood" tab/section alongside existing analytics tabs

#### Visualization
- **Line chart**: Daily average mood per location over 7/14/30 days (using existing chart library or a lightweight SVG-based chart)
- **Dual-axis chart**: When a location is selected, overlay task completion % (left axis) with mood score (right axis)
- **Burnout indicator**: Red pulsing dot + "⚠️ Burnout Warning" badge next to location name when avg mood < 2.5 for 3+ consecutive days

#### API: `GET /api/analytics/mood`
```typescript
// Query: ?days=7|14|30&locationId=xxx (optional)
// Auth: ARL only, scoped to tenant + assignedLocationIds
// Returns: { data: { date: string, locationId: string, locationName: string, avgMood: number, checkinCount: number }[] }
```

---

### 2C. Shift Handoff System

#### Component: `ShiftHandoffOverlay`
- **File**: `src/components/dashboard/shift-handoff.tsx`
- **Type**: Full-screen animated overlay (z-index 40, above dashboard content)
- **Trigger**: Manual "Hand Off Shift" button in dashboard settings panel, or scheduled trigger

#### Handoff Animation Sequence (30 seconds)
1. **0-3s**: Overlay fades in with a "Shift Complete" title and the day-phase gradient
2. **3-10s**: Animated counter showing tasks completed (counting up from 0), tasks remaining, points earned
3. **10-18s**: Scrolling list of remaining tasks with due times, pulsing gently
4. **18-24s**: ARL messages from the shift period, displayed as chat bubbles
5. **24-28s**: Mood score for the shift (aggregate emoji)
6. **28-30s**: "Handed Off ✓" confirmation with a satisfying pulse animation
7. Auto-dismiss at 30s, or tap "Got It" button at any time

#### Shift Period Detection
```typescript
function getShiftPeriod(hour: number): "morning" | "afternoon" | "evening" {
  if (hour < 12) return "morning";
  if (hour < 17) return "afternoon";
  return "evening";
}
```

#### Database Table
```sql
CREATE TABLE shift_handoffs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  shift_date TEXT NOT NULL,
  shift_period TEXT NOT NULL,        -- 'morning' | 'afternoon' | 'evening'
  completed_task_count INTEGER NOT NULL,
  remaining_task_count INTEGER NOT NULL,
  remaining_task_ids TEXT,           -- JSON array
  arl_messages TEXT,                 -- JSON array of { senderName, content, sentAt }
  mood_score_avg REAL,
  handed_off_at TEXT,
  created_at TEXT NOT NULL
);
```

#### API Routes
- `POST /api/shift-handoffs`: Creates handoff record. Computes task counts from `taskCompletions` for current date + location. Returns 409 if handoff already exists for this location/date/period.
- `GET /api/shift-handoffs?locationId=xxx&date=2026-03-23`: Returns handoff history. Accessible to both location and ARL users.

#### Socket Event
On handoff creation, emit `shift:handoff` to tenant ARL sockets + location's own sockets:
```typescript
{ locationId: string, locationName: string, shiftPeriod: string, completedCount: number, remainingCount: number }
```

#### Shift Briefing
When a new session starts at a location, the dashboard checks for a recent handoff for the current shift period. If found, displays a compact "Shift Briefing" card (not the full overlay) showing the previous shift's summary. Dismissible with a tap.

---

### 2D. Smart Shift Summary

#### Component: `SmartSummary`
- **File**: `src/components/dashboard/smart-summary.tsx`
- **Type**: Card component rendered inside the `ShiftHandoffOverlay` or standalone on the ARL analytics page
- **Data source**: Server-computed via `/api/analytics/shift-summary`

#### Summary Generation Logic (Server-Side)
```typescript
// Inputs: locationId, date, shiftPeriod
// 1. Get today's task completions for this location + shift period
// 2. Get yesterday's same shift period completions for comparison
// 3. Compute:
//    - completionDelta: (today - yesterday) / yesterday * 100
//    - fastestTask: task with smallest (completedAt - dueTime) gap
//    - earlyCompletions: count where completedAt < dueTime
//    - totalPoints: sum of pointsEarned + bonusPoints
// 4. Generate text snippets:
//    - "You completed 15% more tasks than yesterday's morning shift!"
//    - "Fastest task: 'Clean fryer' done 12 minutes early 🏎️"
//    - "8 out of 12 tasks completed before their due time — great hustle!"
//    - "Total points earned: 145 pts 🔥"
```

#### API: `GET /api/analytics/shift-summary`
```typescript
// Query: ?locationId=xxx&date=2026-03-23&shiftPeriod=morning
// Auth: location or ARL
// Returns: { summary: { completionDelta, fastestTask, earlyCount, totalPoints, snippets: string[] } }
```

---

## Phase 3: ARL Strategic Tools

### 3A. ARL War Room (Map View)

#### Page: `/arl/war-room`
- **File**: `src/app/arl/war-room/page.tsx`
- **Auth**: ARL only (redirect to `/login` if not authenticated or not ARL)
- **Layout**: Full-viewport canvas/SVG map with a floating filter panel and summary bar

#### Rendering Approach: SVG
- **Why SVG over Canvas**: Interactive nodes need DOM events (hover, tap, focus). SVG scales perfectly. Node count is typically 5-50 (franchise locations), well within SVG performance limits.
- **Why not Mapbox/Google Maps**: Bundle size. The requirement explicitly prohibits external mapping libraries. SVG with configurable coordinates is sufficient for a franchise operations view.

#### Map Layout
```
┌─────────────────────────────────────────────────┐
│  Summary Bar: 12 online · 2 offline · Avg: 78%  │
├─────────────────────────────────────────────────┤
│                                                   │
│     ● Loc A (92%)        ● Loc D (45%)           │
│                    ● Loc B (78%)                  │
│                                                   │
│        ● Loc C (31%)              ● Loc E (88%)  │
│                                                   │
│                    ● Loc F (67%)                  │
│                                                   │
├─────────────────────────────────────────────────┤
│  Filters: [All] [Healthy] [Warning] [Critical]   │
└─────────────────────────────────────────────────┘
```

#### Location Node Component
- SVG `<g>` group containing:
  - Outer pulsing ring: `<circle>` with CSS animation, color from health score
  - Inner filled circle: solid color matching health
  - Label: `<text>` with location name + store number
- **Health color mapping**: green (#10b981) for ≥70, amber (#f59e0b) for 40-69, red (#ef4444) for <40
- **Pulse animation**: CSS `@keyframes` on the outer ring, speed proportional to urgency (faster = more critical)

#### Positioning
- If location has `latitude`/`longitude`: normalize coordinates to SVG viewBox using min/max bounds of all locations + padding
- If no coordinates: auto-arrange in a grid layout (rows of 4-5, evenly spaced)
- Mixed: positioned locations use their coordinates; unpositioned ones fill remaining space in a grid below

#### Interactions
- **Hover/tap**: Tooltip card appears showing: name, store #, health %, task completion %, mood score, active alerts count
- **"Mirror" button**: In tooltip, navigates to `/dashboard?mirror={locationId}&session={sessionId}` (existing mirror infrastructure)
- **Zoom/pan**: SVG `viewBox` manipulation via pointer events. Pinch-to-zoom on touch devices. Mouse wheel zoom on desktop.

#### Filter Panel
- Horizontal pill buttons: All | Healthy (≥70) | Warning (40-69) | Critical (<40)
- Optional mood score range slider
- Location group dropdown (from existing `locationGroups` table)
- Filters apply client-side by hiding/showing SVG nodes

#### Real-Time Updates
- On mount, fetch `/api/arl/war-room/status` for initial state
- Subscribe to `health:changed` socket events for live updates
- When a `health:changed` event arrives, animate the affected node's color transition over 500ms

#### API: `GET /api/arl/war-room/status`
```typescript
// Auth: ARL only
// Returns: {
//   locations: {
//     id, name, storeNumber, healthScore, taskCompletionPct,
//     moodScore, isOnline, latitude, longitude, alertCount
//   }[]
// }
// Scoped to ARL's tenant + assignedLocationIds
```

#### Virtualization
When >50 locations are visible in the current viewport, only render SVG nodes within the visible viewBox bounds + a 20% buffer. Recalculate on pan/zoom.

---

### 3B. War Room Real-Time Overlays

#### Summary Bar Component
- **File**: `src/components/arl/war-room-summary.tsx`
- **Position**: Fixed top bar within the war room page
- **Content**: `{online} online · {offline} offline · Avg Health: {avg}% · {critical} critical`
- **Updates**: Recomputed on every `health:changed` socket event

#### Expanded Detail Overlays
- When zoom level exceeds a threshold (viewBox width < 60% of full), show expanded cards near each visible node
- Card shows: task completion % bar + mood emoji + alert count badge
- Cards use `<foreignObject>` in SVG for rich HTML content

#### Critical Alert Indicator
- Locations with health < 40 get an additional pulsing red ring (larger radius, 50% opacity)
- Ring uses CSS `animation: pulse 1.5s ease-in-out infinite`

---

## Phase 4: Cross-Location Engagement

### 4A. Cross-Location Challenges

#### ARL Management UI
- **File**: `src/app/arl/challenges/page.tsx` (new page)
- **Navigation**: Add "Challenges" to ARL sidebar navigation
- **Layout**: Card-based list of active/past challenges with a "Create Challenge" button

#### Create Challenge Form
Fields:
- Title (text, required)
- Description (textarea, optional)
- Goal type (select): "Consecutive Perfect Days", "Total Points", "Completion Rate", "Fastest Completion"
- Target value (number, required) — meaning depends on goal type
- Start date (date picker, required)
- End date (date picker, required, must be after start)
- Participating locations (multi-select, defaults to all)

#### Location Dashboard Widget: `ChallengeWidget`
- **File**: `src/components/dashboard/challenge-widget.tsx`
- **Position**: Compact card in the dashboard sidebar (right panel in Classic layout, floating card in Pulse layout)
- **Compact view**: Challenge title, location's rank (#2 of 8), progress bar, countdown timer
- **Expanded view**: Full leaderboard with all locations, bracket-style visualization for elimination-style challenges

#### Leaderboard Visualization
- Vertical list sorted by progress value (descending)
- Each row: rank badge, location name, progress bar, progress value
- Current location highlighted with a glow effect
- Real-time updates via `challenge:progress` socket events — rows animate position changes with spring physics

#### Trophy Animation
- When a location wins, render a full-screen overlay for 5 seconds:
  - Golden trophy emoji (🏆) scales in with spring animation
  - Confetti particles burst from the trophy
  - "CHAMPIONS!" text with the challenge title
- Trophy persists as a small badge on the dashboard header for 24 hours (stored in `sessionStorage` with expiry timestamp)

#### Database Tables
```sql
CREATE TABLE challenges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  goal_type TEXT NOT NULL,
  target_value INTEGER NOT NULL,
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  winner_location_id TEXT,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE challenge_participants (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  joined_at TEXT NOT NULL
);

CREATE TABLE challenge_progress (
  id TEXT PRIMARY KEY,
  challenge_id TEXT NOT NULL,
  location_id TEXT NOT NULL,
  date TEXT NOT NULL,
  progress_value INTEGER NOT NULL,
  updated_at TEXT NOT NULL
);
```

#### API Routes
- `GET /api/challenges`: List challenges for tenant. Query: `?status=active|completed|cancelled`
- `POST /api/challenges`: Create challenge (ARL only). Validates end > start.
- `GET /api/challenges/[id]`: Get challenge details + leaderboard
- `PATCH /api/challenges/[id]`: Update status (end/cancel). ARL only.
- `GET /api/challenges/[id]/progress`: Get progress for all participants
- `POST /api/challenges/[id]/progress`: Record daily progress for a location

#### Progress Tracking
- Progress is recorded daily via a scheduled check or on-demand when task completions change
- For "total_points": sum of `dailyLeaderboard.pointsEarned` for the challenge date range
- For "completion_rate": average daily `tasksCompleted / (tasksCompleted + tasksMissed)` × 100
- For "consecutive_perfect_days": count of consecutive days where `tasksMissed === 0`
- For "fastest_completion": average minutes between task `dueTime` and `completedAt`

---

### 4B. Mentorship Pairing System

#### ARL Management UI
- **File**: `src/app/arl/mentorship/page.tsx` (new page)
- **Navigation**: Add "Mentorship" to ARL sidebar navigation
- **Layout**: List of active pairings with mentor/mentee cards, "Create Pairing" button

#### Create Pairing Flow
1. ARL selects mentor location (dropdown, sorted by performance)
2. ARL selects mentee location (dropdown, sorted by performance ascending)
3. System validates neither is already in an active pairing → 409 if conflict
4. Pairing created with status "active"

#### Location Dashboard Widget: `MentorshipWidget`
- **File**: `src/components/dashboard/mentorship-widget.tsx`
- **Position**: Small card in dashboard sidebar
- **Mentor view**: "Mentoring: {mentee name}" · Days paired: 12 · Mentee improvement: +18% · Bonus XP earned: 340
- **Mentee view**: "Mentor: {mentor name}" · Days paired: 12 · Your improvement: +18%

#### Improvement Calculation
```typescript
// On pairing creation, snapshot the mentee's rolling 7-day avg completion rate
// Store as baseline (could be in the mentorship_pairs record metadata or computed on read)
//
// Current improvement = currentRolling7DayAvg - baselineRolling7DayAvg
// If improvement >= 10 percentage points:
//   bonusXP = menteesDailyPoints * 0.20
//   Award to mentor location's dailyLeaderboard
```

#### Bonus XP Award
- Computed daily (or on each task completion event)
- When awarded, emit `mentorship:xp-awarded` socket event to mentor location
- Mentor's dashboard shows a brief "+{xp} Mentor Bonus!" toast animation

#### Database Table
```sql
CREATE TABLE mentorship_pairs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  mentor_location_id TEXT NOT NULL,
  mentee_location_id TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  created_by TEXT NOT NULL,
  created_at TEXT NOT NULL,
  ended_at TEXT
);
```

#### API Routes
- `GET /api/mentorship-pairs`: List pairings for tenant. Query: `?status=active|completed|dissolved`
- `POST /api/mentorship-pairs`: Create pairing (ARL only). Validates no active duplicates.
- `GET /api/mentorship-pairs/[id]`: Get pairing details + improvement stats
- `PATCH /api/mentorship-pairs/[id]`: Update status (dissolve/complete). Sets `ended_at`.

---

## Cross-Cutting Technical Design

### Database Schema Changes

#### New Tables (6)
All defined in `src/lib/db/schema.ts` using Drizzle ORM `sqliteTable`:

1. `mood_checkins` — anonymous mood ratings per location per day
2. `shift_handoffs` — structured shift transition records
3. `challenges` — cross-location competition definitions
4. `challenge_participants` — which locations joined which challenges
5. `challenge_progress` — daily progress tracking per location per challenge
6. `mentorship_pairs` — mentor/mentee location pairings

#### New Columns (3)
- `locations.patternHash` (text, nullable) — bcrypt hash of constellation pattern
- `locations.latitude` (real, nullable) — War Room map positioning
- `locations.longitude` (real, nullable) — War Room map positioning
- `arls.patternHash` (text, nullable) — bcrypt hash of constellation pattern

#### Migration Strategy
- Single migration file generated via `drizzle-kit generate`
- All new columns are nullable → backward compatible
- All new tables are additive → no existing data affected
- Migration runs automatically on app startup via existing `scripts/migrate.js`

---

### Layout Context Extension

#### Changes to `src/lib/layout-context.tsx`
```typescript
// Before
export type DashboardLayout = "classic" | "focus";

// After
export type DashboardLayout = "classic" | "focus" | "pulse";

// Add to LAYOUT_OPTIONS:
{ id: "pulse", name: "Pulse", description: "Heartbeat + floating task orbs" }
```

#### Dashboard Page Integration
In `src/app/dashboard/page.tsx`, the layout switch (currently Classic vs Focus) gains a third branch:
```typescript
{layout === "pulse" && <PulseLayout tasks={tasks} currentTime={time} ... />}
```

The Pulse layout receives the same props as Classic/Focus — it's just a different visual presentation of the same data.

---

### Real-Time Event Integration

#### New Socket Events

| Event | Emitted By | Received By | Payload |
|-------|-----------|-------------|---------|
| `mood:updated` | POST /api/mood-checkins | ARL sockets (same tenant) | `{ locationId, date, avgMoodScore }` |
| `shift:handoff` | POST /api/shift-handoffs | ARL + location sockets (same tenant) | `{ locationId, locationName, shiftPeriod, completedCount, remainingCount }` |
| `challenge:progress` | POST /api/challenges/[id]/progress | All participant + ARL sockets | `{ challengeId, locationId, progressValue, rank }` |
| `mentorship:xp-awarded` | Daily computation / task completion | Mentor location sockets | `{ mentorLocationId, bonusXP, menteeImprovement }` |
| `health:changed` | Task completion/uncomplete events | ARL sockets (same tenant) | `{ locationId, oldScore, newScore }` |

#### Implementation
All events are emitted via the existing `broadcastToTenant(tenantId, event, data)` helper in `src/lib/socket-emit.ts`. The `health:changed` event requires computing the health score delta on each task completion — if the absolute change is ≥10 points, emit the event.

---

### Accessibility Design

#### Canvas Elements
- `Heartbeat` canvas: `aria-label="Restaurant health: {score}%, {overdue} tasks overdue, {dueSoon} due soon"`
- Updated dynamically via React state → DOM attribute

#### Interactive Elements
- All Task Orbs: `aria-label="{title}, due at {time}, {status}"` where status is "overdue", "due soon", "completed", or "upcoming"
- Mood emojis: `aria-label="Mood: {label}"` where label is "Terrible", "Bad", "Okay", "Good", "Great"
- Constellation nodes: `aria-label="Star node {position}"` with `aria-live` announcements

#### Motion Sensitivity
When `prefers-reduced-motion: reduce` is active:
- Day phase background: instant color change (no 3s transition)
- Particles: hidden entirely
- Task orbs: position changes use `duration: 0.1s` instead of spring physics
- Heartbeat: static color circle, no pulse animation
- Constellation trail: simple line, no glow filter

#### Performance Budgets
- Pulse layout: max 30 animated orbs simultaneously
- Day phase particles: max 40 elements
- War Room: virtualize when >50 nodes visible
- All animations: `will-change` + `transform`/`opacity` only (GPU-composited)
- Target: 30+ FPS on Chromebox kiosk hardware (Intel Celeron, 4GB RAM)

---

### File Structure (New Files)

```
src/
├── components/
│   ├── auth/
│   │   └── constellation-grid.tsx          # Pattern login grid
│   ├── dashboard/
│   │   ├── heartbeat.tsx                   # (existing, extend)
│   │   ├── task-orbs.tsx                   # (existing, extend)
│   │   ├── pulse-layout.tsx                # New Pulse layout container
│   │   ├── day-phase-background.tsx        # Ambient background + particles
│   │   ├── mood-checkin.tsx                # Mood check-in prompt overlay
│   │   ├── shift-handoff.tsx               # Shift handoff overlay + briefing
│   │   ├── smart-summary.tsx               # AI-generated shift summary card
│   │   ├── challenge-widget.tsx            # Challenge progress + leaderboard
│   │   └── mentorship-widget.tsx           # Mentorship status card
│   └── arl/
│       ├── war-room-map.tsx                # SVG map with location nodes
│       └── war-room-summary.tsx            # Top summary bar
├── app/
│   ├── arl/
│   │   ├── war-room/
│   │   │   └── page.tsx                    # War Room page
│   │   ├── challenges/
│   │   │   └── page.tsx                    # Challenge management
│   │   └── mentorship/
│   │       └── page.tsx                    # Mentorship management
│   └── api/
│       ├── auth/
│       │   └── set-pattern/
│       │       └── route.ts                # Set constellation pattern
│       ├── mood-checkins/
│       │   └── route.ts                    # GET + POST mood check-ins
│       ├── shift-handoffs/
│       │   └── route.ts                    # GET + POST shift handoffs
│       ├── analytics/
│       │   ├── mood/
│       │   │   └── route.ts                # Mood analytics for ARLs
│       │   └── shift-summary/
│       │       └── route.ts                # Smart shift summary
│       ├── challenges/
│       │   ├── route.ts                    # GET + POST challenges
│       │   └── [id]/
│       │       ├── route.ts                # GET + PATCH challenge
│       │       └── progress/
│       │           └── route.ts            # GET + POST progress
│       ├── mentorship-pairs/
│       │   ├── route.ts                    # GET + POST pairings
│       │   └── [id]/
│       │       └── route.ts                # GET + PATCH pairing
│       └── arl/
│           └── war-room/
│               └── status/
│                   └── route.ts            # War Room status data
├── lib/
│   ├── day-phase-context.tsx               # Day phase provider + hook
│   ├── layout-context.tsx                  # (existing, extend with "pulse")
│   ├── sound-effects.ts                    # (existing, extend with soundscape)
│   └── db/
│       └── schema.ts                       # (existing, extend with new tables)
└── drizzle/
    └── XXXX_dream_dashboard.sql            # Generated migration
```

---

### Dependencies

No new npm dependencies required. The entire feature set is built with:
- **Canvas API** — heartbeat visualization
- **SVG** — constellation grid, war room map
- **Web Audio API** — soundscape synthesis
- **Framer Motion** — already installed, used for all DOM animations
- **Drizzle ORM** — already installed, used for all DB operations
- **Socket.IO** — already installed, used for all real-time events
- **bcryptjs** — already installed, used for pattern hashing

This is intentional. Zero new dependencies means zero bundle size increase from third-party code, zero new supply chain risk, and zero compatibility concerns.
