0# Implementation Plan: Hub Redesign — The Shift

## Overview

Rewrite the visual/interaction layer of The Hub dashboard to the "Warm Industrial" design language. No new API routes or database tables — this is purely UI. The implementation is sequenced so foundational changes (design tokens, day phase context) land first, then individual component rewrites build on top, and finally cross-cutting concerns (accessibility, motion audit) close it out.

## Tasks

- [x] 1. Design Token System & Day Phase Context (Foundation)
  - [x] 1.1 Update `src/app/globals.css` with Warm Industrial design tokens
    - Add `--bg-base-h`, `--bg-base-s`, `--bg-base-l` CSS custom properties to `:root` and `.dark`
    - Add `--card-bg`, `--card-blur`, `--card-border` for Frosted_Glass treatment (`bg-white/5`, `backdrop-blur-xl`, `border-white/10`)
    - Add accent palette tokens: `--warm-amber: #d97706`, `--slate-blue: #64748b`, `--muted-green: #059669`
    - Add typography weight tokens: `--font-weight-header: 900`, `--font-weight-body: 500`
    - Update dark mode as primary theme with warm-tinted card backgrounds and true black base
    - Update light mode as secondary with warm off-whites and subtle shadows
    - Add `background: hsl(var(--bg-base-h), var(--bg-base-s), var(--bg-base-l))` to body with `transition: background 3s ease`
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7_

  - [x] 1.2 Extend `src/lib/day-phase-context.tsx` with HSL background updates
    - Add `PHASE_HSL` map with HSL values for each phase (night: h220/s15/l10, dawn: h35/s10/l12, morning: h200/s12/l11, midday: h210/s10/l12, afternoon: h220/s12/l11, evening: h240/s14/l11)
    - Update `DayPhaseProvider` to set `--bg-base-h`, `--bg-base-s`, `--bg-base-l` on `document.documentElement` every 60 seconds
    - Ensure lightness stays between 10–12% across all phases
    - Ensure max hue delta between adjacent phases ≤ 30 degrees
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5, 2.6, 2.7, 2.8, 2.9_

  - [ ]* 1.3 Write property tests for `computeBackgroundHSL`
    - **Property 1: Dark mode lightness invariant** — For any valid DayPhase, lightness is between 10 and 12 inclusive
    - **Validates: Requirements 2.7**

  - [ ]* 1.4 Write property test for adjacent phase hue delta
    - **Property 2: Adjacent phase hue delta bound** — For any pair of adjacent DayPhases, absolute hue difference ≤ 30 degrees
    - **Validates: Requirements 2.8**

- [x] 2. Checkpoint — Verify design tokens and day phase
  - Ensure all tests pass, ask the user if questions arise.

- [x] 3. Login Page Redesign
  - [x] 3.1 Rewrite `src/app/login/page.tsx` with morphing card and mesh gradient
    - Replace warm gradient background with animated CSS mesh gradient using `@property` for animatable gradients
    - Add fallback to simple radial gradient via `CSS.supports()` feature detection
    - Refactor login card to use Framer Motion `layoutId` for shared-layout morphing between org → userId → PIN/pattern states
    - Maintain constant `rounded-2xl` border-radius and Frosted_Glass treatment during all transitions
    - Cross-fade content within the card shell while morphing card dimensions
    - Replace PIN dot indicators with a horizontal progress bar that fills left-to-right with `--hub-red`
    - Move session code from top-right to an integrated footer strip at the bottom of the card
    - Apply Frosted_Glass treatment to the card: `bg-white/5 backdrop-blur-xl border border-white/10`
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 3.7_

  - [x] 3.2 Enhance `src/components/auth/constellation-grid.tsx` with glow trails
    - Add subtle glow trail effect on constellation grid
    - Add hover pulse effect on constellation nodes
    - _Requirements: 3.8_

  - [ ]* 3.3 Write property test for login card border-radius invariant
    - **Property 6: Login card border-radius invariant** — For any login card state, border-radius remains `rounded-2xl` and Frosted_Glass is applied
    - **Validates: Requirements 3.4**

  - [ ]* 3.4 Write property test for login card state machine
    - **Property 7: Login card state machine validity** — Only valid transitions permitted: org→userId, userId→pin, userId→pattern, pin→userId, pattern→userId
    - **Validates: Requirements 3.9, 3.10**

- [x] 4. Header Redesign
  - [x] 4.1 Rewrite `src/components/dashboard/minimal-header.tsx`
    - Change header height from 48px (`h-12`) to 56px (`h-14`)
    - Apply Frosted_Glass treatment: `bg-white/5 backdrop-blur-xl border-b border-white/10`
    - Left section: "H" logo as rounded square with gradient background, store name + number always visible
    - Center section: Live clock with color-coded food safety indicator dot
    - Right section: 40px touch target icons (`h-10 w-10`) with circular hover backgrounds (`rounded-full hover:bg-white/10`)
    - Restructure Hub Menu to slide down with grouped sections: Display, Shift, Account — separated by dividers
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5, 4.6, 4.11_

  - [x] 4.2 Add persistent XP bar under header
    - Render a 3px-tall bar (`h-[3px]`) spanning full width directly under the header
    - XP bar always visible on all dashboard views
    - Animate width changes with spring physics (stiffness: 100, damping: 20)
    - Tap on XP bar opens the Gamification_Hub profile view
    - _Requirements: 4.7, 4.8, 4.9, 4.10_

- [x] 5. Task Timeline Redesign (Focus Layout)
  - [x] 5.1 Rewrite `src/components/dashboard/timeline.tsx` with left-edge stripes and swipe-to-complete
    - Replace full-row background tinting with 4px left-edge color stripe per task card
    - Stripe colors: overdue → red-500 (with subtle pulse), dueSoon → amber-500, completed → emerald-500, pending → slate-400
    - Implement swipe-right-to-complete gesture using Framer Motion drag with 120px threshold
    - Add gesture disambiguation: only activate swipe when initial movement is >60% horizontal
    - Play checkmark animation (400ms spring) followed by points fly-up (600ms) on completion
    - Provide accessible button fallback for keyboard/screen reader users
    - Apply Frosted_Glass card treatment to task cards
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5, 5.6, 5.7, 5.11_

  - [x] 5.2 Add sticky time headers and current-time indicator
    - Render sticky time grouping headers with task count per time block
    - Display thin horizontal current-time indicator line with time pill
    - Animate current-time indicator with smooth spring transition
    - Collapse completed tasks to single line showing title + checkmark
    - _Requirements: 5.8, 5.9, 5.10_

  - [ ]* 5.3 Write property test for swipe threshold completion
    - **Property 4: Swipe threshold completion** — For any swipe distance, if ≥ 120px then shouldComplete is true; if < 120px then false
    - **Validates: Requirements 5.6**

  - [ ]* 5.4 Write property test for swipe gesture disambiguation
    - **Property 5: Swipe gesture disambiguation** — If horizontal component < 60% of total movement, gesture is treated as vertical scroll
    - **Validates: Requirements 5.11**

  - [ ]* 5.5 Write property test for task stripe color mapping
    - **Property 8: Task stripe color mapping** — Stripe color determined solely by status: overdue→red, dueSoon→amber, completed→emerald, pending→slate
    - **Validates: Requirements 5.2, 5.3, 5.4, 5.5**

  - [ ]* 5.6 Write property test for completed task collapse
    - **Property 9: Completed task collapse** — Completed tasks render as single line with title + checkmark only
    - **Validates: Requirements 5.10**

  - [ ]* 5.7 Write property test for sticky header task counts
    - **Property 10: Sticky header task counts** — Each sticky header task count equals actual number of tasks in that time block
    - **Validates: Requirements 5.8**

- [x] 6. Checkpoint — Verify timeline and header
  - Ensure all tests pass, ask the user if questions arise.

- [x] 7. Pulse Layout Redesign (Radial Wheel)
  - [x] 7.1 Rewrite `src/components/dashboard/pulse-layout.tsx` with radial progress wheel
    - Replace floating orbs (`TaskOrbs`) with a circular SVG ring showing completion percentage
    - Render segments per time block with fill colors: emerald (completed), slate (pending), red (overdue)
    - Position task dots on ring at angles: `(dueHour % 12 * 60 + dueMinute) / 720 * 360` degrees
    - Display health score as large number in center with one-word status below ("Crushing", "Behind", "Steady")
    - Completed dots rendered as filled, overdue dots as pulsing red
    - Tap on task dot opens card overlay with task details and actions
    - Use gentle day-phase color wash background, no particles
    - Group nearby tasks into cluster dots with count badges when > 30 tasks
    - Tap on cluster dot expands to show individual tasks in list overlay
    - Minimum container size of 200px
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5, 6.6, 6.7, 6.8, 6.9, 6.10, 6.11_

  - [ ]* 7.2 Write property test for task dot angular position
    - **Property 3: Task dot angular position** — For any task with valid dueTime, angle = `(dueHour % 12 * 60 + dueMinute) / 720 * 360`, result between 0–360
    - **Validates: Requirements 6.2**

  - [ ]* 7.3 Write property test for radial wheel dot status rendering
    - **Property 15: Radial wheel dot status rendering** — Completed → filled emerald, overdue → pulsing red
    - **Validates: Requirements 6.5, 6.6**

- [x] 8. Bottom Navigation (New Component)
  - [x] 8.1 Create `src/components/dashboard/bottom-nav.tsx`
    - Create new fixed bottom bar component with 5 tabs: Tasks, Chat, Mood, Calendar, Menu
    - Render at 64px height (`h-16`) with Frosted_Glass treatment
    - Active tab: filled icon with dot indicator below (using Framer Motion `layoutId` for dot animation)
    - Inactive tab: outlined icon
    - Hidden on `sm` breakpoint and above (`sm:hidden`)
    - Menu tab opens Hub_Menu as a bottom sheet with 300ms spring(300, 30) translateY animation
    - All tab touch targets ≥ 40px
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5, 7.6, 7.7, 14.3_

  - [ ]* 8.2 Write property test for bottom nav tab icon state
    - **Property 13: Bottom nav tab icon state** — Active tab has filled icon + dot; inactive has outlined icon without dot. Mutually exclusive and exhaustive.
    - **Validates: Requirements 7.3, 7.4**

- [x] 9. Checkpoint — Verify pulse layout and bottom nav
  - Ensure all tests pass, ask the user if questions arise.

- [x] 10. Chat Panel Redesign
  - [x] 10.1 Restyle `src/components/dashboard/restaurant-chat.tsx` with iMessage bubbles
    - Sent message bubbles: iMessage-style rounded corners (rounded except sender corner) with `--hub-red` background
    - Received message bubbles: Frosted_Glass treatment
    - Add animated dots typing indicator
    - Add waveform visualization for voice messages
    - Conversation list avatars as circles with initials, color-coded by conversation type
    - Mobile: full-screen view from Bottom_Nav
    - Desktop: resizable panel with drag handle
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5, 8.6, 8.7_

- [x] 11. ARL Sidebar Redesign
  - [x] 11.1 Rewrite `src/components/arl/arl-sidebar.tsx` with collapse-to-icons behavior
    - Default state: collapsed icons-only at 64px width
    - Expand to 260px on hover with smooth 200ms transition
    - Collapse back to 64px when cursor leaves with smooth 200ms transition
    - Apply Frosted_Glass treatment to sidebar background
    - _Requirements: 9.1, 9.2, 9.3_

- [-] 12. ARL Overview Redesign
  - [x] 12.1 Rewrite `src/components/arl/overview-dashboard.tsx` with command strip
    - Replace KPI cards with horizontal command strip bar showing: online count, overdue count, completion %, total points
    - Add sparkline charts within command strip metrics
    - Location list as primary view below command strip
    - Thin colored health bar per location
    - Expandable inline task list and activity mirror per location
    - Apply Frosted_Glass treatment to all cards
    - _Requirements: 10.1, 10.2, 10.3, 10.4, 10.5_

- [ ] 13. Gamification Hub Redesign
  - [x] 13.1 Rewrite `src/components/dashboard/gamification-hub.tsx`
    - XP bar always visible under header at 3px height, full width
    - Tap XP bar opens profile view (full-screen on mobile, wider panel on desktop)
    - Profile shows: level progress, streak calendar (GitHub-style contribution grid), badge grid, leaderboard
    - Badge unlock: 2-second fullscreen radial burst animation (2000ms spring)
    - Leaderboard: colored circle avatars with animated position changes
    - Fallback: if gamification API fails, XP bar renders at 0% with no animation; retry on next socket event or 30s interval
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5, 11.6, 11.7_

- [ ] 14. Shift Handoff Redesign
  - [x] 14.1 Rewrite `src/components/dashboard/shift-handoff.tsx` as swipeable card stack
    - Replace auto-advancing phases with swipeable card stack (user swipes manually)
    - Remove auto-advance timer; cards only change on explicit user swipe
    - "Got It" button always visible at bottom with ≥ 64px touch target
    - Apply muted shift-period gradient as background
    - Apply Frosted_Glass treatment to cards
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 14.5_

  - [ ]* 14.2 Write property test for shift handoff no auto-advance
    - **Property 17: Shift handoff no auto-advance** — Without user interaction, visible card does not change over time
    - **Validates: Requirements 12.4**

- [ ] 15. Mood Check-in Redesign
  - [x] 15.1 Rewrite `src/components/dashboard/mood-checkin.tsx` as slide-up card
    - Replace blocking modal with non-blocking slide-up card from bottom
    - Trigger 5 minutes after login (not immediately)
    - Emoji options at 64px size with text labels
    - First dismiss: reappear after 30 minutes
    - Second dismiss: suppress for remainder of session
    - Completion: thank-you animation then slide down to dismiss
    - Apply Frosted_Glass treatment to card
    - _Requirements: 13.1, 13.2, 13.3, 13.4, 13.5, 13.6_

  - [ ]* 15.2 Write property test for mood check-in dismiss behavior
    - **Property 16: Mood check-in dismiss behavior** — First dismiss → reappear after 30min, second dismiss → suppressed for session
    - **Validates: Requirements 13.4, 13.5**

- [x] 16. Checkpoint — Verify all component rewrites
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 17. Style Updates (Minor Components)
  - [x] 17.1 Update `src/components/arl/war-room-map.tsx` styles
    - Apply Frosted_Glass treatment to map overlays and pins
    - Dark pulsing pins for active incidents
    - _Requirements: 1.4_

  - [x] 17.2 Update `src/components/arl/analytics-dashboard.tsx` chart styles
    - Apply consistent Warm Industrial styling to all chart components
    - Use accent palette colors for chart series
    - _Requirements: 1.5_

  - [x] 17.3 Update `src/components/dashboard/heartbeat.tsx` styles
    - Apply Frosted_Glass treatment and Warm Industrial color palette
    - _Requirements: 1.4_

  - [x] 17.4 Update `src/components/dashboard/celebrations.tsx` styles
    - Apply Warm Industrial styling to celebration overlays
    - _Requirements: 1.4_

  - [x] 17.5 Update `src/components/dashboard/leaderboard.tsx` styles
    - Apply Frosted_Glass treatment and colored circle avatars
    - _Requirements: 1.4, 11.5_

- [ ] 18. Animation System & Accessibility Audit
  - [x] 18.1 Implement global animation constants and `prefers-reduced-motion` support
    - Create shared animation constants matching the Animation Specification appendix (page transition 200ms, card press 150ms, list stagger 30ms, etc.)
    - Ensure all Framer Motion animations respect `prefers-reduced-motion: reduce` by setting duration to 0ms and disabling transforms
    - Audit all components for `prefers-reduced-motion` compliance
    - Verify all icon touch targets ≥ 40px (Header, Bottom_Nav)
    - Verify primary action touch targets ≥ 64px (Shift_Handoff "Got It" button)
    - Verify swipe-to-complete has accessible button fallback
    - _Requirements: 14.1, 14.2, 14.3, 14.4, 14.5, 15.1, 15.2, 15.3, 15.4, 15.5, 15.6, 15.7, 15.8_

  - [ ]* 18.2 Write property test for reduced motion disabling animations
    - **Property 11: Reduced motion disables animations** — When `prefers-reduced-motion` is enabled, animation duration is 0ms and no transforms play
    - **Validates: Requirements 14.1**

  - [ ]* 18.3 Write property test for touch target minimum dimensions
    - **Property 12: Touch target minimum dimensions** — Icon targets ≥ 40px, primary action targets ≥ 64px
    - **Validates: Requirements 14.3, 14.4, 14.5, 4.6**

  - [ ]* 18.4 Write property test for Hub Menu section ordering
    - **Property 14: Hub Menu section ordering** — Sections always in order Display → Shift → Account with dividers
    - **Validates: Requirements 4.11**

- [x] 19. Final Checkpoint — Full integration verification
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document
- The design uses TypeScript throughout — all implementation tasks use TypeScript + React
- No new API routes or database changes are needed; this is purely visual/interaction layer
- Dark mode is the primary design target; light mode is secondary
