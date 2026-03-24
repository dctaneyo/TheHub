# Requirements Document

## Introduction

This document defines the requirements for "Hub Redesign: The Shift" — a purely visual/interaction-layer redesign of The Hub franchise restaurant management dashboard. The redesign applies a "Warm Industrial" aesthetic across all existing components. No new database tables, API routes, or features are introduced. Dark mode is the primary design target.

## Glossary

- **Design_Token_System**: The set of CSS custom properties in `globals.css` that define the Warm Industrial visual language (colors, typography weights, card treatments)
- **DayPhaseProvider**: The existing React context (`day-phase-context.tsx`) extended to update background HSL custom properties based on time of day
- **Login_Card**: The single frosted-glass card on the login page that morphs between org, userId, and PIN/pattern states
- **Header**: The top navigation bar (`minimal-header.tsx`) rendered at 56px height with logo, clock, action icons, and XP bar
- **XP_Bar**: A persistent 3px-tall progress bar spanning full width under the header, showing gamification experience progress
- **Task_Timeline**: The Focus layout task list (`timeline.tsx`) displaying tasks with left-edge color stripes, swipe-to-complete, and sticky time headers
- **Radial_Wheel**: The Pulse layout component (`pulse-layout.tsx`) rendering a circular SVG ring with task dots positioned at clock-face angles
- **Bottom_Nav**: A new fixed 5-tab mobile navigation bar (`bottom-nav.tsx`) with Tasks, Chat, Mood, Calendar, and Menu tabs
- **Chat_Panel**: The messaging interface (`restaurant-chat.tsx`) with iMessage-style bubbles and typing indicators
- **ARL_Sidebar**: The ARL navigation sidebar (`arl-sidebar.tsx`) that collapses to icons-only by default
- **ARL_Overview**: The ARL dashboard (`overview-dashboard.tsx`) with a horizontal command strip and expandable location list
- **Gamification_Hub**: The profile/badge/leaderboard system (`gamification-hub.tsx`) accessed by tapping the XP bar
- **Shift_Handoff**: The shift transition component (`shift-handoff.tsx`) using a swipeable card stack
- **Mood_Checkin**: The mood check-in component (`mood-checkin.tsx`) rendered as a non-blocking slide-up card
- **Frosted_Glass**: The global card treatment: `bg-white/5`, `backdrop-blur-xl`, `border border-white/10`
- **Hub_Menu**: The settings/actions menu opened from the header, organized into Display, Shift, and Account sections

## Requirements

### Requirement 1: Design Token System

**User Story:** As a developer, I want a centralized design token system defining the Warm Industrial visual language, so that all components share a consistent aesthetic.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define dark mode as the primary theme with warm-tinted card backgrounds and true black base colors
2. THE Design_Token_System SHALL define light mode as a secondary theme with warm off-white backgrounds and subtle shadows
3. THE Design_Token_System SHALL provide CSS custom properties for background HSL values (`--bg-base-h`, `--bg-base-s`, `--bg-base-l`) that the DayPhaseProvider updates
4. THE Design_Token_System SHALL define the Frosted_Glass card treatment as `bg-white/5`, `backdrop-blur-xl`, and `border border-white/10`
5. THE Design_Token_System SHALL define the accent palette including `--hub-red: #e4002b`, `--warm-amber: #d97706`, `--slate-blue: #64748b`, and `--muted-green: #059669`
6. THE Design_Token_System SHALL define typography weights as `--font-weight-header: 900` (font-black) and `--font-weight-body: 500` (font-medium)
7. THE Design_Token_System SHALL restrict `--hub-red` usage to active states, urgent badges, and the logo

### Requirement 2: Time-of-Day Background Shift

**User Story:** As a user, I want the app background to subtly shift hue based on the time of day, so that the interface feels alive without being distracting.

#### Acceptance Criteria

1. THE DayPhaseProvider SHALL update the background HSL custom properties every 60 seconds
2. WHEN the phase is "night", THE DayPhaseProvider SHALL set background HSL to approximately h:220, s:15%, l:10%
3. WHEN the phase is "dawn", THE DayPhaseProvider SHALL set background HSL to approximately h:35, s:10%, l:12%
4. WHEN the phase is "morning", THE DayPhaseProvider SHALL set background HSL to approximately h:200, s:12%, l:11%
5. WHEN the phase is "midday", THE DayPhaseProvider SHALL set background HSL to approximately h:210, s:10%, l:12%
6. WHEN the phase is "evening", THE DayPhaseProvider SHALL set background HSL to approximately h:240, s:14%, l:11%
7. THE DayPhaseProvider SHALL keep background lightness between 10% and 12% across all phases to maintain dark mode appearance
8. THE DayPhaseProvider SHALL limit the maximum hue delta between adjacent phases to 30 degrees or fewer
9. THE DayPhaseProvider SHALL apply a 3-second CSS ease transition when shifting between phase HSL values

### Requirement 3: Login Page

**User Story:** As a user, I want an animated, polished login experience with smooth card transitions, so that the first impression of the app feels premium.

#### Acceptance Criteria

1. THE Login_Card SHALL render over a full-bleed animated CSS mesh gradient background
2. IF the browser does not support CSS `@property` or mesh gradients, THEN THE Login_Card SHALL fall back to a simple radial gradient using the same base HSL values
3. THE Login_Card SHALL morph between org, userId, and PIN/pattern states using Framer Motion shared-layout animation (`layoutId`)
4. WHEN transitioning between states, THE Login_Card SHALL maintain constant border-radius (rounded-2xl) and Frosted_Glass treatment throughout the morph
5. WHEN transitioning between states, THE Login_Card SHALL cross-fade content within the card shell while morphing card dimensions smoothly
6. THE Login_Card SHALL display a horizontal progress bar for PIN entry that fills left-to-right with `--hub-red` color, replacing the previous dot indicators
7. THE Login_Card SHALL display the session code in an integrated footer strip at the bottom of the card
8. WHEN a user hovers over a constellation grid node, THE Login_Card SHALL display a subtle glow trail and pulse effect on the node
9. WHEN the login card is in the PIN state, THE Login_Card SHALL only allow valid transitions: pin→userId (back navigation)
10. WHEN the login card is in the userId state, THE Login_Card SHALL allow transitions to either pin or pattern state based on user configuration

### Requirement 4: Header

**User Story:** As a user, I want a compact but informative header with live clock, food safety indicator, and quick access to key actions, so that I always have essential information visible.

#### Acceptance Criteria

1. THE Header SHALL render at exactly 56px height with Frosted_Glass treatment
2. THE Header SHALL display the "H" logo as a rounded square with a gradient background in the left section
3. THE Header SHALL always display the store name and store number in the left section
4. THE Header SHALL display a live clock in the center section
5. THE Header SHALL display a color-coded food safety indicator dot adjacent to the live clock
6. THE Header SHALL render action icons at 40px touch target size with circular hover backgrounds in the right section
7. THE XP_Bar SHALL render as a 3px-tall bar spanning full width directly under the Header
8. THE XP_Bar SHALL be persistently visible on all dashboard views
9. WHEN XP points are earned, THE XP_Bar SHALL animate the width change using spring physics (stiffness: 100, damping: 20)
10. WHEN a user taps the XP_Bar, THE Gamification_Hub SHALL open the profile view
11. WHEN the Hub_Menu is opened, THE Header SHALL slide the menu down with grouped sections: Display, Shift, and Account, separated by dividers

### Requirement 5: Task Timeline (Focus Layout)

**User Story:** As a crew member, I want to see my tasks in a clear timeline with visual status indicators and quick completion gestures, so that I can efficiently manage my shift work.

#### Acceptance Criteria

1. THE Task_Timeline SHALL display a 4px left-edge color stripe on each task card instead of full-row background tinting
2. WHEN a task is overdue, THE Task_Timeline SHALL color the left stripe red-500 with a subtle pulse animation
3. WHEN a task is due soon, THE Task_Timeline SHALL color the left stripe amber-500
4. WHEN a task is completed, THE Task_Timeline SHALL color the left stripe emerald-500
5. WHEN a task is pending with no urgency, THE Task_Timeline SHALL color the left stripe slate-400
6. WHEN a user swipes a task card to the right past the threshold (120px), THE Task_Timeline SHALL trigger a checkmark animation followed by points flying up from the card
7. THE Task_Timeline SHALL provide a button fallback for task completion accessible to keyboard and screen reader users
8. THE Task_Timeline SHALL render sticky time grouping headers that display the task count for each time block
9. THE Task_Timeline SHALL display a thin horizontal current-time indicator line with a time pill that scrolls smoothly
10. WHEN a task is completed, THE Task_Timeline SHALL collapse the task to a single line showing only the title and a checkmark
11. WHEN a user swipes a task card and the initial movement direction is less than 60% horizontal, THE Task_Timeline SHALL default to vertical scroll instead of swipe-to-complete

### Requirement 6: Pulse Layout (Radial Wheel)

**User Story:** As a crew member, I want a visual overview of my shift progress as a radial wheel, so that I can quickly gauge how my shift is going at a glance.

#### Acceptance Criteria

1. THE Radial_Wheel SHALL render as a circular SVG ring with segments corresponding to time blocks
2. THE Radial_Wheel SHALL position task dots on the ring at angles calculated as `(dueHour % 12 * 60 + dueMinute) / 720 * 360` degrees
3. THE Radial_Wheel SHALL display the health score as a large number in the center of the ring
4. THE Radial_Wheel SHALL display a one-word status label below the health score (e.g., "Crushing", "Behind", "Steady")
5. WHEN a task is completed, THE Radial_Wheel SHALL render the corresponding dot as a filled dot and fill the ring segment with emerald color
6. WHEN a task is overdue, THE Radial_Wheel SHALL render the corresponding dot as a pulsing red dot
7. WHEN a user taps a task dot on the ring, THE Radial_Wheel SHALL display a card overlay with task details and actions
8. THE Radial_Wheel SHALL use a gentle day-phase color wash background with no particles
9. WHEN more than 30 tasks need to be placed on the ring, THE Radial_Wheel SHALL group nearby tasks into cluster dots with count badges
10. WHEN a user taps a cluster dot, THE Radial_Wheel SHALL expand the cluster to show individual tasks in a list overlay
11. THE Radial_Wheel SHALL require a minimum container size of 200px

### Requirement 7: Bottom Navigation

**User Story:** As a mobile user, I want a bottom navigation bar for quick access to key sections, so that I can navigate the app with one hand.

#### Acceptance Criteria

1. THE Bottom_Nav SHALL render as a fixed bar at the bottom of the viewport on mobile screen sizes only (hidden on sm breakpoint and above)
2. THE Bottom_Nav SHALL display exactly 5 tabs: Tasks, Chat, Mood, Calendar, and Menu
3. WHEN a tab is active, THE Bottom_Nav SHALL display a filled icon with a dot indicator below the icon
4. WHEN a tab is inactive, THE Bottom_Nav SHALL display an outlined icon
5. THE Bottom_Nav SHALL apply Frosted_Glass treatment matching the global card style
6. WHEN the Menu tab is tapped, THE Bottom_Nav SHALL open the Hub_Menu as a bottom sheet
7. THE Bottom_Nav SHALL render at 64px height (h-16) with items justified evenly

### Requirement 8: Chat Panel

**User Story:** As a crew member, I want a modern chat interface with clear message distinction, so that I can communicate efficiently with my team.

#### Acceptance Criteria

1. THE Chat_Panel SHALL render sent message bubbles with iMessage-style rounded corners (rounded except sender corner) using `--hub-red` background color
2. THE Chat_Panel SHALL render received message bubbles with Frosted_Glass treatment
3. WHEN another user is typing, THE Chat_Panel SHALL display an animated dots typing indicator
4. WHEN a voice message is present, THE Chat_Panel SHALL display a waveform visualization
5. THE Chat_Panel SHALL display conversation list avatars as circles with initials, color-coded by conversation type
6. WHEN on mobile, THE Chat_Panel SHALL render as a full-screen view accessible from the Bottom_Nav
7. WHEN on desktop, THE Chat_Panel SHALL render as a resizable panel with a drag handle

### Requirement 9: ARL Sidebar

**User Story:** As an ARL (Area Restaurant Leader), I want a compact sidebar that expands on demand, so that I have maximum screen space for my overview dashboard.

#### Acceptance Criteria

1. THE ARL_Sidebar SHALL render in a collapsed icons-only state by default at 64px width
2. WHEN a user hovers over the ARL_Sidebar, THE ARL_Sidebar SHALL expand to 260px width with a smooth 200ms transition
3. WHEN the user moves the cursor away from the ARL_Sidebar, THE ARL_Sidebar SHALL collapse back to 64px width with a smooth 200ms transition

### Requirement 10: ARL Overview

**User Story:** As an ARL, I want a command strip with key metrics and an expandable location list, so that I can monitor all my locations at a glance.

#### Acceptance Criteria

1. THE ARL_Overview SHALL display a horizontal command strip bar showing online count, overdue count, completion percentage, and total points
2. THE ARL_Overview SHALL display sparkline charts within the command strip metrics
3. THE ARL_Overview SHALL display a location list as the primary view below the command strip
4. THE ARL_Overview SHALL display a thin colored health bar for each location in the list
5. WHEN a user expands a location in the list, THE ARL_Overview SHALL display an inline task list and activity mirror for that location

### Requirement 11: Gamification System

**User Story:** As a crew member, I want to see my XP progress, streaks, badges, and leaderboard position, so that I stay motivated and engaged during my shift.

#### Acceptance Criteria

1. THE XP_Bar SHALL be always visible under the Header at 3px height spanning full width
2. WHEN a user taps the XP_Bar, THE Gamification_Hub SHALL open a profile view (full-screen on mobile, wider panel on desktop)
3. THE Gamification_Hub SHALL display level progress, a streak calendar (GitHub-style contribution grid), a badge grid, and a leaderboard
4. WHEN a badge is unlocked, THE Gamification_Hub SHALL play a 2-second fullscreen radial burst animation
5. THE Gamification_Hub SHALL display leaderboard entries with colored circle avatars and animated position changes
6. IF the gamification API fails to return XP data, THEN THE XP_Bar SHALL render at 0% width with no animation and no error message shown to the user
7. IF the gamification API fails, THEN THE XP_Bar SHALL retry fetching data on the next socket event or after a 30-second interval

### Requirement 12: Shift Handoff

**User Story:** As a crew member ending or starting a shift, I want to review handoff information at my own pace, so that I don't miss important details.

#### Acceptance Criteria

1. THE Shift_Handoff SHALL display handoff information as a swipeable card stack instead of auto-advancing phases
2. THE Shift_Handoff SHALL display a "Got It" confirmation button that is always visible at the bottom of the view
3. THE Shift_Handoff SHALL apply a muted shift-period gradient as the background
4. THE Shift_Handoff SHALL NOT auto-advance between cards; the user swipes manually

### Requirement 13: Mood Check-in

**User Story:** As a crew member, I want a non-intrusive mood check-in that doesn't block my workflow, so that I can share how I'm feeling without interruption.

#### Acceptance Criteria

1. THE Mood_Checkin SHALL render as a slide-up card from the bottom of the screen, not as a blocking modal
2. THE Mood_Checkin SHALL trigger 5 minutes after user login
3. THE Mood_Checkin SHALL display emoji options at 64px size with text labels
4. WHEN a user dismisses the Mood_Checkin for the first time, THE Mood_Checkin SHALL reappear after 30 minutes
5. WHEN a user dismisses the Mood_Checkin for the second time, THE Mood_Checkin SHALL not reappear for the remainder of the session
6. WHEN a user completes the mood check-in, THE Mood_Checkin SHALL play a thank-you animation and slide down to dismiss

### Requirement 14: Accessibility and Motion

**User Story:** As a user with motion sensitivity, I want animations to respect my system preferences, so that I can use the app comfortably.

#### Acceptance Criteria

1. WHEN `prefers-reduced-motion` is enabled, THE Design_Token_System SHALL set all animation durations to 0ms and disable all transform animations
2. THE Task_Timeline SHALL provide a button fallback for swipe-to-complete that is accessible via keyboard and screen reader
3. THE Bottom_Nav SHALL ensure all tab touch targets meet the minimum 40px dimension requirement
4. THE Header SHALL ensure all action icon touch targets are at least 40px in dimension
5. THE Shift_Handoff SHALL ensure the "Got It" button touch target is at least 64px for primary action accessibility

### Requirement 15: Animation System

**User Story:** As a user, I want smooth, consistent animations across the app, so that interactions feel polished and responsive.

#### Acceptance Criteria

1. THE Design_Token_System SHALL define page transitions at 200ms with ease easing using opacity cross-fade
2. THE Design_Token_System SHALL define card press animations at 150ms with spring easing using scale(0.98) to scale(1)
3. THE Design_Token_System SHALL define list item stagger at 30ms per item with ease-out easing using opacity and translateY(8px to 0)
4. WHEN a task is completed, THE Task_Timeline SHALL play a 400ms spring checkmark animation followed by a 600ms points-fly-to-XP-bar animation
5. WHEN a badge is unlocked, THE Gamification_Hub SHALL play a 2000ms spring radial burst animation
6. THE Hub_Menu SHALL animate open with a 200ms ease-out translateY(-8px to 0) plus opacity transition
7. THE Bottom_Nav SHALL animate bottom sheets with a 300ms spring(300, 30) translateY transition
8. WHEN a task stripe is overdue, THE Task_Timeline SHALL animate the stripe opacity between 0.6 and 1.0 on a 2000ms ease-in-out infinite loop
