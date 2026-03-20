# Implementation Plan: ARL Refactor & CSP Nonce

## Overview

This plan decomposes the monolithic ARL page into a Next.js App Router layout with nested route segments, then implements per-request CSP nonces in Edge middleware. Tasks are ordered so each step builds on the previous, with property-based tests placed close to the code they validate.

## Tasks

- [x] 1. Create utility functions and type definitions for route mapping
  - [x] 1.1 Create `src/lib/arl-views.ts` with `ArlView` type, `VIEW_ROUTE_MAP`, `pathnameToViewId()`, `viewIdToPathname()`, and `computeSlideDirection()` helper
    - Export the `ArlView` union type (currently duplicated in `page.tsx` and `arl-sidebar.tsx`)
    - Export `VIEW_ROUTE_MAP: Record<ArlView, string>` mapping each of the 15 view IDs to their route pathname
    - Export `pathnameToViewId(pathname: string): ArlView` that extracts the segment after `/arl/` and maps it back, defaulting to `"overview"` for unknown segments
    - Export `viewIdToPathname(view: ArlView): string` as a simple lookup into `VIEW_ROUTE_MAP`
    - Export `computeSlideDirection(from: ArlView, to: ArlView, navItems: {id: string}[]): 1 | -1` that compares ordinal indices
    - _Requirements: 2.1, 2.4, 4.2_

  - [ ]* 1.2 Write property test: View ID ↔ Pathname Round-Trip (Property 1)
    - **Property 1: View ID ↔ Pathname Round-Trip**
    - Use `fast-check` to generate random `ArlView` values from the 15-element set
    - Assert `pathnameToViewId(VIEW_ROUTE_MAP[view]) === view` for all views
    - Assert `VIEW_ROUTE_MAP[pathnameToViewId(path)] === path` for all valid pathnames
    - **Validates: Requirements 2.1, 2.4, 1.4**

  - [ ]* 1.3 Write property test: Slide Direction from Ordinal Position (Property 4)
    - **Property 4: Slide Direction from Ordinal Position**
    - Use `fast-check` to generate two distinct indices into the `navItems` array
    - Assert direction is `1` when destination index > source index, `-1` otherwise
    - **Validates: Requirements 4.2**

- [x] 2. Create `ArlDashboardContext` provider
  - [x] 2.1 Create `src/lib/arl-dashboard-context.tsx` with context definition and provider component
    - Define `ArlDashboardContextValue` interface with all fields from the design (activeView, navigateToView, swipeDirection, unreadCount, onlineCount, activeMeetings, joiningMeeting, activeBroadcast, watchingBroadcast, showBroadcastNotification, notificationPermission, pushSubscription, requestNotificationPermission, sidebarOpen, isMobileOrTablet, device, toasts, notifToast)
    - Implement `ArlDashboardProvider` that:
      - Derives `activeView` from `usePathname()` via `pathnameToViewId()`
      - Implements `navigateToView()` using `router.push()` with direction tracking via `computeSlideDirection()`
      - Registers all socket event listeners (`task:completed`, `presence:update`, `meeting:started`, `meeting:ended`, `meeting:list`, `message:new`, `conversation:updated`, `message:read`)
      - Fetches initial online count from `/api/locations` and unread count from `/api/messages` on mount
      - Delta-updates online count from `presence:update` events using a `Set<string>` ref
      - Creates task completion toasts with location name resolution from a cached map
      - Manages notification permission and push subscription state
      - Implements permission-based route guard via `useEffect` that redirects to `/arl` when user lacks required permission
    - Export `useArlDashboard()` hook
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 2.4, 3.1, 3.3_

  - [ ]* 2.2 Write property test: Presence Delta-Update Correctness (Property 2)
    - **Property 2: Presence Delta-Update Correctness**
    - Extract the presence delta-update logic into a pure testable function `applyPresenceUpdate(onlineSet: Set<string>, event: {userId, userType, isOnline}): Set<string>`
    - Use `fast-check` to generate random sequences of presence events
    - Assert final count equals unique location userIds whose last event was `isOnline: true`
    - **Validates: Requirements 1.6**

  - [ ]* 2.3 Write property test: Task Completion Toast Content (Property 3)
    - **Property 3: Task Completion Toast Content**
    - Extract toast creation logic into a pure function `createTaskToast(payload, locationNames): TaskToast`
    - Use `fast-check` to generate random payloads and location name maps
    - Assert toast contains resolved name (or fallback), exact title, and exact points
    - **Validates: Requirements 1.7**

  - [ ]* 2.4 Write property test: Permission-Based Route Guard (Property 5)
    - **Property 5: Permission-Based Route Guard**
    - Use `fast-check` to generate random role, permissions subset, and restricted view
    - Assert redirect occurs iff `hasPermission(role, perms, VIEW_PERMISSIONS[view])` is false
    - **Validates: Requirements 3.1**

  - [ ]* 2.5 Write property test: Permission-Based Sidebar Filtering (Property 6)
    - **Property 6: Permission-Based Sidebar Filtering**
    - Extract sidebar filtering logic into a pure function `filterSidebarItems(role, permissions, navItems, sidebarPermMap)`
    - Use `fast-check` to generate random role and permissions subset
    - Assert visible set matches expected based on `SIDEBAR_PERM_MAP` and `hasPermission`
    - **Validates: Requirements 3.2**

- [x] 3. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [-] 4. Create ARL layout and route pages
  - [x] 4.1 Create `src/app/arl/layout.tsx`
    - Wrap `{children}` in `ArlDashboardProvider`
    - Render `ArlSidebar`, header bar, mobile `PageIndicator`, `OfflineIndicator`, overlay components (`BroadcastStudio`, `MeetingRoom`), toast containers, `HighFiveAnimation`, `SocialActionsMenu`, and broadcast notification popup
    - Pass `navigateToView` from context to `ArlSidebar` `onViewChange` prop
    - Wrap `{children}` in `AnimatePresence` with spring transition (stiffness 300, damping 30)
    - Attach `useSwipeNavigation` hook for mobile gesture navigation (disabled when sidebar open)
    - Move all shared UI chrome from current `page.tsx` into this layout
    - _Requirements: 1.1, 1.2, 1.3, 2.3, 3.2, 4.1, 4.3, 4.4_

  - [x] 4.2 Create 15 route page files under `src/app/arl/`
    - `src/app/arl/page.tsx` — overview: renders `OverviewDashboard`
    - `src/app/arl/messages/page.tsx` — renders `Messaging`
    - `src/app/arl/tasks/page.tsx` — renders `TaskManager`
    - `src/app/arl/calendar/page.tsx` — extract inline calendar to `src/components/arl/arl-calendar.tsx`, render it
    - `src/app/arl/locations/page.tsx` — renders `LocationsManager`
    - `src/app/arl/forms/page.tsx` — renders `FormsRepository`
    - `src/app/arl/emergency/page.tsx` — renders `EmergencyBroadcast`
    - `src/app/arl/users/page.tsx` — renders `UserManagement`
    - `src/app/arl/leaderboard/page.tsx` — renders `Leaderboard`
    - `src/app/arl/remote/page.tsx` — renders `RemoteManagement`
    - `src/app/arl/data-management/page.tsx` — renders `DataManagement`
    - `src/app/arl/broadcast/page.tsx` — renders `BroadcastStudio` inline (full viewport)
    - `src/app/arl/meetings/page.tsx` — renders active meetings list, `ScheduledMeetings`, `MeetingAnalyticsDashboard`
    - `src/app/arl/analytics/page.tsx` — renders `AnalyticsDashboard`
    - `src/app/arl/tenant-settings/page.tsx` — renders `TenantSettings`
    - Each page is a thin `"use client"` wrapper importing the existing component
    - _Requirements: 2.1, 2.2, 5.2, 5.3_

  - [x] 4.3 Update `ArlSidebar` to use shared `ArlView` type from `src/lib/arl-views.ts`
    - Import `ArlView` from `@/lib/arl-views` instead of defining it locally
    - No logic changes needed — `onViewChange` prop already accepts a view ID
    - _Requirements: 3.2_

  - [x] 4.4 Remove sessionStorage persistence from old `page.tsx`
    - Delete the `sessionStorage.getItem("arl-active-view")` read on mount
    - Delete the `sessionStorage.setItem("arl-active-view", ...)` write on change
    - The old `page.tsx` is replaced by the new route pages; ensure no residual sessionStorage references remain
    - _Requirements: 5.1_

- [x] 5. Checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 6. Implement CSP nonce generation in Edge middleware
  - [x] 6.1 Add `generateNonce()` and `buildCspHeader(nonce)` functions to `src/middleware.ts`
    - `generateNonce()`: use `crypto.getRandomValues(new Uint8Array(16))` and encode as base64
    - `buildCspHeader(nonce)`: build the CSP directive string with `'nonce-${nonce}'` in `script-src` and `style-src`, retaining all existing directives, no `'unsafe-inline'`
    - Call these in the `middleware()` function and set `Content-Security-Policy` and `x-nonce` response headers on every HTML response
    - Ensure the nonce is set on all response paths (redirects excluded, but normal `NextResponse.next()` responses included)
    - _Requirements: 6.1, 6.2, 6.3, 6.4_

  - [ ]* 6.2 Write property test: Nonce Generation Validity (Property 7)
    - **Property 7: Nonce Generation Validity**
    - Export `generateNonce()` for testing
    - Assert each generated nonce is valid base64 decoding to exactly 16 bytes
    - Assert no duplicates in a batch of 100
    - **Validates: Requirements 6.1**

  - [ ]* 6.3 Write property test: CSP Header Correctness (Property 8)
    - **Property 8: CSP Header Correctness**
    - Export `buildCspHeader(nonce)` for testing
    - Use `fast-check` to generate random valid base64 nonce strings
    - Assert: nonce in script-src, nonce in style-src, no unsafe-inline, sentry domain in script-src, fonts domain in style-src, all required directives present
    - **Validates: Requirements 6.2, 6.3, 6.4, 7.3, 7.4**

- [x] 7. Propagate nonce to root layout and remove static CSP
  - [x] 7.1 Update `src/app/layout.tsx` to read nonce from headers and apply to inline scripts
    - Convert to async server component using `import { headers } from "next/headers"`
    - Read `x-nonce` from `headers().get("x-nonce")`
    - Add `nonce` attribute to the `dangerouslySetInnerHTML` `<script>` tag (iOS Safari pinch-to-zoom block)
    - Add `<meta name="csp-nonce" content={nonce} />` in `<head>` for Sentry SDK
    - _Requirements: 7.1, 7.2, 9.1_

  - [x] 7.2 Remove static CSP header from `next.config.ts`
    - Remove the `Content-Security-Policy` entry from the `headers()` return array
    - Keep all other security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security, X-XSS-Protection)
    - Remove the `cspHeader` variable definition
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 7.3 Update `sentry.client.config.ts` to read nonce from meta tag
    - Read nonce via `document.querySelector('meta[name="csp-nonce"]')?.getAttribute('content')`
    - Pass nonce to Sentry init if available (for dynamically injected scripts)
    - _Requirements: 9.1, 9.2_

- [x] 8. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties from the design document using `fast-check`
- The project uses vitest as the test runner (51 existing tests)
- All code is TypeScript/React (Next.js App Router)
