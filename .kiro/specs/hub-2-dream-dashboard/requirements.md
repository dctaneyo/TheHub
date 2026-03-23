# Requirements Document — Hub 2.0 Dream Dashboard

## Introduction

Hub 2.0 Dream Dashboard is a major reimagining of The Hub's franchise restaurant management dashboard. It transforms the existing utilitarian interface into a living, breathing, ambient experience that communicates operational state through organic visualizations, spatial layouts, and environmental cues. The feature set spans eleven interconnected systems organized into four implementation phases: Core Ambient Experience (including a keyboard-free Constellation Pattern login), Crew & Shift Intelligence, ARL Strategic Tools, and Cross-Location Engagement.

The existing codebase runs Next.js 16 (App Router) with TypeScript, TailwindCSS v4, SQLite via better-sqlite3 + Drizzle ORM, Framer Motion, Socket.IO for real-time, and LiveKit for video. Two components — `heartbeat.tsx` and `task-orbs.tsx` — already exist on the `hub-2.0-dream` branch and serve as the foundation for Phase 1.

## Glossary

- **Hub**: The franchise restaurant management dashboard application
- **Dashboard**: The main location-facing fullscreen kiosk view at `/dashboard`
- **ARL**: Above Restaurant Leader — management users who oversee multiple restaurant locations
- **Location**: A single restaurant franchise location, represented by a kiosk running Chrome Kiosk mode
- **Kiosk**: A touchscreen device at a restaurant location running the Hub in Chrome Kiosk mode
- **Heartbeat_Visualization**: A canvas-based animated visualization at the center of the dashboard reflecting real-time operational health via color, pulse speed, and organic ring animations
- **Health_Score**: A 0–100 integer derived from task completion rates, overdue counts, and due-soon counts for a location on a given day
- **Task_Orb**: A floating circular UI element representing a single task in the Pulse layout, positioned radially around the Heartbeat_Visualization
- **Pulse_Layout**: A new dashboard layout option (alongside "Classic" and "Focus") that renders tasks as spatial orbs around a central heartbeat
- **Day_Phase**: One of six time-of-day periods (Dawn, Morning, Midday, Afternoon, Evening, Night) that drive ambient visual and audio changes
- **Mood_Checkin**: A single anonymous emoji-based mood rating (1–5 scale) submitted by a crew member at shift start
- **Shift_Handoff**: A structured transition event between outgoing and incoming crews, summarizing completed work, remaining tasks, and ARL messages
- **War_Room**: An ARL-only geographic map view at `/arl/war-room` showing all locations as health-pulsing nodes
- **Challenge**: A time-bound cross-location competition created by an ARL with specific goals and a real-time leaderboard
- **Soundscape_Engine**: The system responsible for playing ambient audio cues (chimes, tones, completion sounds) that vary by day phase and event type
- **Smart_Summary**: An AI-generated end-of-day or end-of-shift textual summary highlighting performance patterns and trends
- **Mentorship_Pair**: A pairing between a high-performing location (mentor) and a struggling location (mentee) for knowledge sharing and bonus XP
- **Socket_Server**: The Socket.IO server that handles real-time communication between clients and the Hub backend
- **Layout_Context**: The React context (`layout-context.tsx`) that manages the active dashboard layout preference per user
- **Tenant**: A franchise brand/organization in the multi-tenant system, identified by a slug
- **Constellation_Pattern**: A touch-drawn path across a 3×3 grid of star nodes used as a keyboard-free authentication method, stored as a hashed sequence of node indices
- **Pattern_Node**: One of nine interactive star-shaped touch targets in the 3×3 constellation grid, visually themed to the current Day_Phase

---

## Phase 1: Core Ambient Experience

### Requirement 1A: Constellation Pattern Login

**User Story:** As a restaurant crew member with wet or gloved hands, I want to authenticate by tracing a pattern across a constellation of stars on the touchscreen, so that I can log in quickly without needing a physical keyboard, mouse, or precise digit entry.

#### Acceptance Criteria

1. THE Login page SHALL offer a "Constellation Login" mode as an alternative to the existing 4-digit PIN entry, toggled via a visible tab or button labeled with a constellation icon.
2. THE Constellation_Pattern grid SHALL render a 3×3 grid of nine Pattern_Nodes displayed as glowing star shapes, spaced generously for easy touch targeting (minimum 64×64px touch area per node).
3. WHEN a user touches a Pattern_Node and drags across other nodes, THE grid SHALL draw a visible trail line connecting the visited nodes in sequence, with a glowing effect matching the current Day_Phase color palette.
4. THE Constellation_Pattern SHALL require a minimum of 4 connected nodes and a maximum of 9 nodes to form a valid pattern.
5. WHEN the user lifts their finger (touchend) or releases the mouse button, THE Login page SHALL submit the pattern sequence for authentication.
6. THE pattern sequence SHALL be represented as an ordered array of node indices (0–8), hashed using bcrypt on the server side, and stored in a new `patternHash` column (text, nullable) on both the `locations` and `arls` database tables.
7. THE Hub SHALL expose a `POST /api/auth/login` route enhancement that accepts either `{ userId, pin }` (existing) or `{ userId, pattern }` (new) — where `pattern` is the ordered array of node indices — and authenticates accordingly.
8. IF a user has both a PIN and a Constellation_Pattern configured, THEN THE Login page SHALL allow authentication via either method.
9. IF a user has only a Constellation_Pattern configured (no PIN), THEN THE Login page SHALL default to the constellation grid after user ID validation.
10. THE Hub SHALL expose a `POST /api/auth/set-pattern` route (authenticated, location or ARL) that accepts a pattern array (4–9 node indices, no repeated consecutive nodes), hashes it, and stores it in the user's `patternHash` field.
11. WHEN the user traces a pattern, THE grid SHALL provide haptic feedback (via `navigator.vibrate`) on each node activation if the device supports it.
12. THE constellation grid SHALL visually theme its star nodes based on the current Day_Phase: warm golden stars for Dawn/Morning, bright white stars for Midday/Afternoon, cool blue-silver stars for Evening/Night.
13. WHEN an incorrect pattern is submitted, THE grid SHALL play a brief shake animation and the trail line SHALL flash red before clearing, consistent with the existing PIN error behavior.
14. THE Constellation_Pattern input SHALL include an `aria-label` on the grid container describing the interaction ("Draw a pattern across the stars to log in") and announce node connections via `aria-live` for screen reader users.
15. THE constellation grid SHALL support both touch input (primary, for kiosks) and mouse input (fallback, for desktop testing) using pointer events.
16. WHEN the Login page is in Constellation mode, THE background SHALL display subtle twinkling star particles behind the grid to reinforce the celestial theme, respecting `prefers-reduced-motion` by disabling the particles.

### Requirement 1: Heartbeat Visualization Engine

**User Story:** As a restaurant crew member, I want to glance at the dashboard and immediately feel the operational state of the restaurant without reading any text, so that I can intuitively sense whether things are on track or need attention.

#### Acceptance Criteria

1. THE Heartbeat_Visualization SHALL render a canvas-based animation at the center of the Pulse_Layout displaying organic pulse rings, a breathing scale effect, and color transitions.
2. WHEN the Health_Score is 90 or above, THE Heartbeat_Visualization SHALL display in green (#10b981) with a calm pulse speed of 0.7 cycles per second.
3. WHEN the Health_Score is between 50 and 89 inclusive, THE Heartbeat_Visualization SHALL transition to amber (#f59e0b) with a moderate pulse speed of 1.1–1.4 cycles per second.
4. WHEN the Health_Score is below 50, THE Heartbeat_Visualization SHALL display in red (#ef4444) with an elevated pulse speed of 1.8–2.5 cycles per second.
5. WHEN the overdue task count changes, THE Heartbeat_Visualization SHALL smoothly transition its pulse speed and color within 500 milliseconds.
6. THE Heartbeat_Visualization SHALL render three expanding concentric pulse rings that fade as they expand outward from the center.
7. THE Heartbeat_Visualization SHALL render an inner organic blob shape with subtle wobble deformation to create a living, breathing appearance.
8. THE Heartbeat_Visualization SHALL display the Health_Score percentage, current points earned today, current streak count, overdue task count, and due-soon task count as overlaid text.
9. THE Heartbeat_Visualization SHALL support two size modes: a large mode (280px) for the Pulse_Layout center and a compact mode (160px) for use in other layouts.
10. THE Heartbeat_Visualization SHALL use `requestAnimationFrame` for rendering and SHALL cancel the animation frame on component unmount to prevent memory leaks.
11. THE Heartbeat_Visualization SHALL derive its Health_Score from the formula: `100 - (overdueCount * 15) - (dueSoonCount * 5)`, clamped between 0 and 100.

### Requirement 2: Spatial Task Orbs (Pulse Layout)

**User Story:** As a restaurant crew member, I want to see my tasks as floating orbs arranged spatially by urgency around the heartbeat, so that I can prioritize at a glance and interact with tasks in a more engaging way.

#### Acceptance Criteria

1. THE Pulse_Layout SHALL render Task_Orbs in a radial arrangement around the Heartbeat_Visualization, with each orb's distance from center determined by urgency.
2. WHEN a task is overdue, THE Task_Orb SHALL position itself within 20–30% of the center radius and glow with a red pulsing shadow.
3. WHEN a task is due within 30 minutes, THE Task_Orb SHALL position itself within 35–45% of the center radius and glow with an amber shadow.
4. WHEN a task is not urgent, THE Task_Orb SHALL position itself at 40–75% of the center radius based on minutes until due time.
5. WHEN a task is completed, THE Task_Orb SHALL position itself at 85% of the center radius with reduced opacity (0.5) and a grayscale appearance.
6. THE Task_Orb SHALL display a type-specific emoji (📋 for task, 🧹 for cleaning, ⏰ for reminder), a points badge, and a priority-based gradient background.
7. WHEN a user taps a Task_Orb, THE Dashboard SHALL display a detail card overlay showing the task title, description, due time, points value, and complete/undo action buttons.
8. WHEN a user completes a task via the detail card, THE Task_Orb SHALL play a dissolve-to-particles animation over 1500 milliseconds before repositioning to the completed orbit.
9. THE Pulse_Layout SHALL be registered as a new layout option with id "pulse", name "Pulse", and description "Heartbeat + floating task orbs" in the Layout_Context alongside "classic" and "focus".
10. THE Layout_Context SHALL persist the "pulse" layout selection to the database via the existing `/api/preferences/layout` endpoint.
11. THE Pulse_Layout SHALL render decorative orbital ring guides at 30%, 50%, and 70% of the container to provide spatial reference.
12. WHEN the task list updates via Socket_Server events, THE Pulse_Layout SHALL animate orb position changes using spring physics (stiffness: 100, damping: 15).

### Requirement 3: Ambient Day Phases

**User Story:** As a restaurant crew member, I want the dashboard UI to subtly shift its visual atmosphere throughout the day, so that the interface feels alive and contextually appropriate to the current period of operations.

#### Acceptance Criteria

1. THE Dashboard SHALL define six Day_Phases with the following time boundaries: Dawn (05:00–07:59), Morning (08:00–10:59), Midday (11:00–13:59), Afternoon (14:00–16:59), Evening (17:00–19:59), Night (20:00–close).
2. WHEN the current time crosses a Day_Phase boundary, THE Dashboard SHALL transition the background gradient over 3 seconds using CSS transitions.
3. THE Dawn Day_Phase SHALL apply a warm rose-to-peach gradient with soft particle effects simulating early light.
4. THE Morning Day_Phase SHALL apply a bright sky-blue-to-white gradient with energetic, upward-drifting particles.
5. THE Midday Day_Phase SHALL apply a warm golden-to-white gradient with minimal particle effects.
6. THE Afternoon Day_Phase SHALL apply an amber-to-soft-orange gradient with gentle, slow-drifting particles.
7. THE Evening Day_Phase SHALL apply a deep blue-to-purple gradient with sparse, twinkling star-like particles.
8. THE Night Day_Phase SHALL apply a dark navy-to-charcoal gradient with dim, slow-pulsing ambient particles.
9. THE Day_Phase system SHALL use the location's configured timezone (from the `locations.timezone` or `tenants.timezone` database field) to determine the current local time.
10. THE Day_Phase background SHALL render behind all dashboard content at z-index 0 and SHALL NOT interfere with touch interactions on dashboard elements.
11. WHILE the Day_Phase transitions, THE Dashboard SHALL maintain full interactivity with no frame drops below 30 FPS on the target kiosk hardware.


### Requirement 4: Ambient Soundscape System

**User Story:** As a restaurant crew member, I want subtle audio cues that blend into the kitchen environment and change with the time of day, so that I receive non-intrusive auditory feedback about task states without jarring alarms.

#### Acceptance Criteria

1. THE Soundscape_Engine SHALL extend the existing sound system (`src/lib/sound-effects.ts`) with day-phase-aware sound profiles.
2. WHEN a task becomes due (reaches its `dueTime`), THE Soundscape_Engine SHALL play a gentle chime sound appropriate to the current Day_Phase.
3. WHEN a task is completed, THE Soundscape_Engine SHALL play a satisfying low-frequency "thunk" confirmation sound.
4. WHEN a task becomes overdue, THE Soundscape_Engine SHALL play a gradually rising tone over 2 seconds to create subtle urgency without alarm.
5. THE Soundscape_Engine SHALL define distinct sound profiles for each Day_Phase: warmer tones for Dawn/Morning, brighter tones for Midday/Afternoon, and softer tones for Evening/Night.
6. THE Soundscape_Engine SHALL respect the existing per-location sound mute setting (`locations.soundMuted` database field and the `soundEnabled` state in the dashboard).
7. WHEN an ARL toggles sound for a location via the `location:sound-toggle` socket event, THE Soundscape_Engine SHALL immediately reflect the new mute state.
8. THE Soundscape_Engine SHALL use the Web Audio API (`AudioContext`) to synthesize sounds, creating a fresh context per sound event to avoid Chrome's suspended-context restrictions.
9. THE Soundscape_Engine SHALL provide a configuration UI accessible from the existing dashboard settings panel, allowing per-location selection of sound profile intensity (off, subtle, normal).
10. THE Soundscape_Engine SHALL NOT play sounds between 23:00 and 05:00 local time, consistent with the existing voice announcement quiet hours.

---

## Phase 2: Crew & Shift Intelligence

### Requirement 5: Crew Mood Check-in System

**User Story:** As a restaurant crew member, I want to quickly tap an emoji to record how I'm feeling at the start of my shift, so that management can track team morale trends without identifying individuals.

#### Acceptance Criteria

1. WHEN a user logs into a location kiosk and no mood check-in has been recorded for the current session, THE Dashboard SHALL display a mood check-in prompt overlay.
2. THE Mood_Checkin prompt SHALL present five emoji options representing a 1–5 mood scale: 😫 (1), 😕 (2), 😐 (3), 🙂 (4), 🤩 (5).
3. WHEN a user taps a mood emoji, THE Dashboard SHALL record the Mood_Checkin and dismiss the prompt within 300 milliseconds.
4. THE Mood_Checkin SHALL be stored in a new `mood_checkins` database table with columns: `id` (text, primary key), `tenant_id` (text, not null), `location_id` (text, not null), `date` (text, not null, YYYY-MM-DD), `mood_score` (integer, not null, 1–5), `created_at` (text, not null).
5. THE Mood_Checkin system SHALL NOT store any user-identifying information — only the location ID and date.
6. THE Dashboard SHALL store a session flag (in `sessionStorage`) after a mood check-in to prevent duplicate prompts within the same browser session.
7. THE Hub SHALL expose a `POST /api/mood-checkins` API route that validates the mood score is between 1 and 5 inclusive and associates the check-in with the authenticated location's tenant and location IDs.
8. THE Hub SHALL expose a `GET /api/mood-checkins` API route that returns mood check-in data filtered by tenant, with optional `locationId` and `dateRange` query parameters, accessible only to ARL users.
9. IF a mood check-in request contains a mood score outside the 1–5 range, THEN THE Hub SHALL return a 400 status code with a descriptive error message.
10. THE Mood_Checkin prompt SHALL appear only on location kiosks (userType "location"), not on ARL dashboards.

### Requirement 6: ARL Mood Analytics

**User Story:** As an ARL, I want to see aggregate mood trends across my locations over time and correlate mood data with task completion rates, so that I can identify early signs of burnout or morale issues.

#### Acceptance Criteria

1. THE ARL Analytics page SHALL include a "Crew Mood" section displaying aggregate mood scores per location per day as a line chart over a configurable date range (7, 14, 30 days).
2. THE ARL Analytics page SHALL display the average mood score across all locations for the selected date range.
3. WHEN an ARL selects a specific location, THE Analytics page SHALL show that location's daily mood trend alongside its task completion rate on a dual-axis chart.
4. WHEN the average mood score for a location drops below 2.5 for 3 consecutive days, THE Analytics page SHALL display a "Burnout Warning" indicator next to that location's name.
5. THE mood analytics data SHALL be scoped to the ARL's tenant and, if the ARL has `assignedLocationIds`, filtered to only those assigned locations.
6. THE Hub SHALL expose a `GET /api/analytics/mood` API route returning aggregated mood data (average score per location per day) for the authenticated ARL's tenant.

### Requirement 7: Shift Handoff System

**User Story:** As a restaurant crew member finishing a shift, I want to see a clear summary of what was accomplished and what remains, so that the incoming crew can start their shift with full context.

#### Acceptance Criteria

1. WHEN a shift handoff is triggered (manually via a "Hand Off Shift" button or on a configured schedule), THE Dashboard SHALL display a 30-second animated summary overlay.
2. THE Shift_Handoff summary SHALL display: number of tasks completed during the shift, number of tasks remaining, list of remaining task titles and due times, any ARL messages sent during the shift, and the aggregate mood score for the shift period.
3. THE Shift_Handoff summary SHALL be stored in a new `shift_handoffs` database table with columns: `id` (text, primary key), `tenant_id` (text, not null), `location_id` (text, not null), `shift_date` (text, not null, YYYY-MM-DD), `shift_period` (text, not null — "morning", "afternoon", "evening"), `completed_task_count` (integer, not null), `remaining_task_count` (integer, not null), `remaining_task_ids` (text — JSON array), `arl_messages` (text — JSON array of message summaries), `mood_score_avg` (real), `handed_off_at` (text), `created_at` (text, not null).
4. WHEN the outgoing crew taps "Handed Off", THE Dashboard SHALL record the `handed_off_at` timestamp and emit a `shift:handoff` Socket_Server event to notify the ARL dashboard.
5. WHEN a new session begins at a location after a handoff has been recorded for the current shift period, THE Dashboard SHALL display a "Shift Briefing" card showing the handoff summary from the previous shift.
6. THE Hub SHALL expose a `POST /api/shift-handoffs` API route that creates a handoff record, calculating completed and remaining task counts from the `taskCompletions` table for the current date and location.
7. THE Hub SHALL expose a `GET /api/shift-handoffs` API route returning handoff history for a location, accessible to both location users and ARLs.
8. IF a shift handoff has already been recorded for the current location, date, and shift period, THEN THE Hub SHALL return a 409 status code with a message indicating a handoff already exists for this period.
9. THE Shift_Handoff summary animation SHALL auto-dismiss after 30 seconds or when the user taps a "Got It" button, whichever comes first.

### Requirement 8: Smart Shift Summary

**User Story:** As a restaurant crew member ending my shift, I want to see an AI-generated summary highlighting performance patterns and achievements, so that I feel recognized for good work and aware of areas for improvement.

#### Acceptance Criteria

1. WHEN a shift ends or a shift handoff is triggered, THE Dashboard SHALL display a Smart_Summary card with pattern-based insights generated from the shift's task data.
2. THE Smart_Summary SHALL include at minimum: comparison of task completion count to the previous day's same shift period, identification of the fastest-completed task, count of tasks completed before their due time, and the total points earned during the shift.
3. THE Smart_Summary SHALL use positive, encouraging language (e.g., "Great hustle!" for early completions, "You completed 15% more tasks than yesterday").
4. THE Hub SHALL expose a `GET /api/analytics/shift-summary` API route that accepts `locationId`, `date`, and `shiftPeriod` parameters and returns the computed summary data.
5. THE Smart_Summary generation SHALL be computed server-side by comparing current shift data against historical data from the `taskCompletions` and `dailyLeaderboard` tables.
6. THE Smart_Summary SHALL be available in the ARL Analytics dashboard for any location and date, in addition to appearing on the location kiosk at shift end.

---

## Phase 3: ARL Strategic Tools

### Requirement 9: ARL War Room (Map View)

**User Story:** As an ARL, I want to see all my locations on a geographic map with real-time health indicators, so that I can quickly identify which locations need attention and mirror into them directly.

#### Acceptance Criteria

1. THE Hub SHALL provide a new page at `/arl/war-room` accessible only to authenticated ARL users.
2. THE War_Room SHALL render an SVG/canvas-based map displaying all locations assigned to the ARL as interactive nodes.
3. THE War_Room SHALL display each location node with a pulsing animation whose color matches the location's current Health_Score (green for 70+, amber for 40–69, red for below 40).
4. THE War_Room SHALL update location node health colors in real-time via Socket_Server events without requiring page refresh.
5. WHEN an ARL hovers over or taps a location node, THE War_Room SHALL display a tooltip showing: location name, store number, current Health_Score, task completion percentage for today, current mood score (if available), and number of active alerts.
6. WHEN an ARL taps a location node and selects "Mirror", THE War_Room SHALL navigate to the existing mirror mode (`/dashboard?mirror={locationId}&session={sessionId}`) for that location.
7. THE War_Room SHALL support zoom and pan interactions for navigating regions with many locations.
8. THE War_Room SHALL display location positions based on configurable coordinates stored in the `locations` table (new `latitude` and `longitude` columns, both real, nullable).
9. IF a location has no configured coordinates, THEN THE War_Room SHALL position the location node in an auto-arranged grid layout.
10. THE War_Room SHALL provide a filter panel allowing the ARL to filter locations by health status (healthy, warning, critical), mood score range, and location group.
11. THE War_Room SHALL use a lightweight SVG/canvas rendering approach and SHALL NOT depend on external mapping libraries (e.g., Mapbox, Google Maps) to keep the bundle size minimal.

### Requirement 10: War Room Real-Time Overlays

**User Story:** As an ARL viewing the War Room, I want to see task completion rates, mood scores, and active alerts overlaid on the map, so that I can assess regional performance at a glance.

#### Acceptance Criteria

1. WHEN an ARL zooms into a region of the War_Room map, THE War_Room SHALL display expanded detail overlays for each visible location showing task completion percentage and mood score.
2. THE War_Room SHALL display a summary bar at the top showing: total locations online, total locations offline, average Health_Score across all locations, and count of locations in critical status (Health_Score below 40).
3. WHEN a location's Health_Score drops below 40, THE War_Room SHALL display a pulsing alert indicator on that location's node.
4. THE Hub SHALL expose a `GET /api/arl/war-room/status` API route returning the current health score, task completion stats, mood score, online status, and coordinates for all locations in the ARL's tenant scope.
5. THE War_Room status API SHALL return data scoped to the ARL's `assignedLocationIds` if configured, or all tenant locations if the ARL has no location restrictions.


---

## Phase 4: Cross-Location Engagement

### Requirement 11: Cross-Location Challenges

**User Story:** As an ARL, I want to create time-bound challenges that pit locations against each other in friendly competition, so that I can drive engagement and task completion through gamification.

#### Acceptance Criteria

1. THE Hub SHALL provide a challenge management UI on the ARL dashboard allowing ARLs to create, edit, and end challenges.
2. WHEN an ARL creates a challenge, THE Hub SHALL require: a title, a description, a goal type (one of: "consecutive_perfect_days", "total_points", "completion_rate", "fastest_completion"), a target value, a start date, and an end date.
3. THE Challenge data SHALL be stored in a new `challenges` database table with columns: `id` (text, primary key), `tenant_id` (text, not null), `title` (text, not null), `description` (text), `goal_type` (text, not null), `target_value` (integer, not null), `start_date` (text, not null, YYYY-MM-DD), `end_date` (text, not null, YYYY-MM-DD), `status` (text, not null — "active", "completed", "cancelled"), `created_by` (text, not null), `winner_location_id` (text), `created_at` (text, not null), `updated_at` (text, not null).
4. THE Hub SHALL store challenge participation in a new `challenge_participants` database table with columns: `id` (text, primary key), `challenge_id` (text, not null), `location_id` (text, not null), `joined_at` (text, not null).
5. THE Hub SHALL store challenge progress in a new `challenge_progress` database table with columns: `id` (text, primary key), `challenge_id` (text, not null), `location_id` (text, not null), `date` (text, not null, YYYY-MM-DD), `progress_value` (integer, not null), `updated_at` (text, not null).
6. THE Dashboard SHALL display an active challenge widget showing the challenge title, the location's current progress, the leaderboard position, and a countdown to the challenge end date.
7. THE challenge leaderboard SHALL update in real-time via Socket_Server events when any participating location's progress changes.
8. WHEN a challenge ends and a winner is determined, THE Hub SHALL record the `winner_location_id` on the challenge record and emit a `challenge:completed` Socket_Server event.
9. WHEN a location wins a challenge, THE Dashboard SHALL display a digital trophy animation on the winning location's kiosk for 24 hours.
10. THE Hub SHALL expose CRUD API routes at `/api/challenges` (GET, POST), `/api/challenges/[id]` (GET, PATCH), and `/api/challenges/[id]/progress` (GET, POST) with appropriate ARL-only and location-scoped access controls.
11. IF an ARL attempts to create a challenge with an end date before the start date, THEN THE Hub SHALL return a 400 status code with a descriptive error message.
12. THE challenge widget on the location Dashboard SHALL render as a compact card that can be expanded to show the full bracket-style leaderboard visualization.

### Requirement 12: Mentorship Pairing System

**User Story:** As an ARL, I want to pair high-performing locations with struggling ones so that knowledge sharing happens organically and mentor locations earn bonus XP for their mentee's improvements.

#### Acceptance Criteria

1. THE Hub SHALL provide a mentorship management UI on the ARL dashboard allowing ARLs to create, view, and dissolve mentorship pairings.
2. THE Mentorship_Pair data SHALL be stored in a new `mentorship_pairs` database table with columns: `id` (text, primary key), `tenant_id` (text, not null), `mentor_location_id` (text, not null), `mentee_location_id` (text, not null), `status` (text, not null — "active", "completed", "dissolved"), `created_by` (text, not null), `created_at` (text, not null), `ended_at` (text).
3. WHEN a mentee location's daily task completion rate improves by 10 percentage points or more compared to the 7-day average before the pairing started, THE Hub SHALL award the mentor location bonus XP equal to 20% of the mentee's daily points earned.
4. THE Dashboard SHALL display a mentorship status widget on both the mentor and mentee location kiosks showing: pairing partner name, days paired, mentee's improvement trend, and bonus XP earned (mentor) or improvement percentage (mentee).
5. THE Hub SHALL expose API routes at `/api/mentorship-pairs` (GET, POST) and `/api/mentorship-pairs/[id]` (GET, PATCH) with ARL-only access for creation and management.
6. IF an ARL attempts to create a mentorship pair where either location is already in an active pairing, THEN THE Hub SHALL return a 409 status code with a descriptive error message.
7. THE Hub SHALL calculate mentee improvement by comparing the mentee's rolling 7-day average task completion rate at pairing creation against the current rolling 7-day average.
8. WHEN a mentorship pair is dissolved or completed, THE Hub SHALL record the `ended_at` timestamp and stop awarding bonus XP.

---

## Cross-Cutting Requirements

### Requirement 13: Database Schema Migrations

**User Story:** As a developer, I want all new database tables and columns to be defined as Drizzle ORM schema additions with corresponding SQL migration files, so that the database evolves safely and consistently.

#### Acceptance Criteria

1. THE Hub SHALL add the following new tables to the Drizzle schema (`src/lib/db/schema.ts`): `mood_checkins`, `shift_handoffs`, `challenges`, `challenge_participants`, `challenge_progress`, `mentorship_pairs`.
2. THE Hub SHALL add the following new columns to the existing `locations` table: `latitude` (real, nullable), `longitude` (real, nullable) for War_Room positioning, and `patternHash` (text, nullable) for Constellation_Pattern authentication.
3. THE Hub SHALL add a new `patternHash` (text, nullable) column to the existing `arls` table for Constellation_Pattern authentication.
4. THE Hub SHALL generate a Drizzle migration file for all schema changes using `drizzle-kit`.
5. THE migration SHALL be backward-compatible — all new columns SHALL have default values or be nullable, and no existing columns SHALL be removed or renamed.
6. THE migration script (`scripts/migrate.js`) SHALL apply the new migration automatically on application startup, consistent with the existing migration pattern.

### Requirement 14: Layout Context Extension

**User Story:** As a developer, I want the Layout_Context to support the new "pulse" layout option, so that users can switch to the Pulse_Layout and have their preference persisted.

#### Acceptance Criteria

1. THE Layout_Context (`src/lib/layout-context.tsx`) SHALL extend the `DashboardLayout` type to include "pulse" as a valid option: `"classic" | "focus" | "pulse"`.
2. THE `LAYOUT_OPTIONS` array SHALL include a new entry: `{ id: "pulse", name: "Pulse", description: "Heartbeat + floating task orbs" }`.
3. WHEN a user selects the "pulse" layout, THE Layout_Context SHALL persist the selection via the existing `POST /api/preferences/layout` endpoint.
4. WHEN the dashboard loads with the "pulse" layout preference, THE Dashboard SHALL render the Pulse_Layout with the Heartbeat_Visualization and Task_Orbs instead of the Classic or Focus layout.
5. THE existing mirror mode SHALL correctly sync the "pulse" layout selection between ARL and target location, consistent with how "classic" and "focus" layouts are synced.

### Requirement 15: Real-Time Event Integration

**User Story:** As a developer, I want all new features to integrate with the existing Socket.IO infrastructure for real-time updates, so that changes propagate instantly across connected clients.

#### Acceptance Criteria

1. WHEN a mood check-in is submitted, THE Socket_Server SHALL emit a `mood:updated` event to all ARL clients in the same tenant.
2. WHEN a shift handoff is recorded, THE Socket_Server SHALL emit a `shift:handoff` event to all ARL clients in the same tenant and to the location's own connected sessions.
3. WHEN challenge progress changes, THE Socket_Server SHALL emit a `challenge:progress` event to all participating location clients and ARL clients in the same tenant.
4. WHEN a mentorship pair's bonus XP is awarded, THE Socket_Server SHALL emit a `mentorship:xp-awarded` event to the mentor location's connected sessions.
5. WHEN a location's Health_Score changes by 10 or more points, THE Socket_Server SHALL emit a `health:changed` event to all ARL clients in the same tenant for War_Room updates.
6. THE Socket_Server SHALL scope all new events to the appropriate tenant to prevent cross-tenant data leakage.

### Requirement 16: Accessibility and Performance

**User Story:** As a developer, I want all new UI components to meet accessibility standards and perform well on kiosk hardware, so that the dashboard remains usable and responsive for all crew members.

#### Acceptance Criteria

1. THE Heartbeat_Visualization canvas element SHALL include an `aria-label` attribute describing the current health status in text form (e.g., "Restaurant health: 85%, 2 tasks due soon").
2. THE Task_Orb buttons SHALL include `aria-label` attributes describing the task name, due time, and status.
3. THE Mood_Checkin emoji buttons SHALL include `aria-label` attributes describing the mood level (e.g., "Mood: Great").
4. THE Day_Phase background animations SHALL use CSS `will-change` and GPU-accelerated properties to maintain 30+ FPS on target kiosk hardware.
5. THE Pulse_Layout SHALL limit the number of simultaneously animated orbs to 30 to prevent performance degradation on lower-powered kiosk devices.
6. WHEN the `prefers-reduced-motion` media query is active, THE Dashboard SHALL disable particle effects, reduce animation durations by 80%, and use simple opacity transitions instead of spring physics.
7. THE War_Room SVG rendering SHALL use virtualization to render only visible location nodes when more than 50 locations are in view.

### Requirement 17: Existing Component Integration

**User Story:** As a developer, I want the new Dream Dashboard features to integrate with the existing `heartbeat.tsx` and `task-orbs.tsx` components on the `hub-2.0-dream` branch, so that work already done is preserved and extended rather than rewritten.

#### Acceptance Criteria

1. THE Pulse_Layout SHALL use the existing `Heartbeat` component from `src/components/dashboard/heartbeat.tsx` as its center visualization, extending its props as needed rather than creating a new component.
2. THE Pulse_Layout SHALL use the existing `TaskOrbs` component from `src/components/dashboard/task-orbs.tsx` as its task rendering layer, extending its props as needed rather than creating a new component.
3. WHEN extending the existing components, THE Hub SHALL maintain backward compatibility with the current `HeartbeatProps` and `TaskOrbsProps` interfaces by making all new props optional.
4. THE existing `TaskItem` interface from `src/components/dashboard/timeline.tsx` SHALL be reused by the Task_Orbs component without modification.
5. THE Pulse_Layout SHALL integrate with the existing dashboard page (`src/app/dashboard/page.tsx`) using the same data fetching, socket event handling, and celebration system as the Classic and Focus layouts.
