# Requirements Document

## Introduction

This feature covers two architecture improvements to "The Hub" franchise management dashboard:

1. **ARL Page Refactor** — Decompose the monolithic ~1100-line `src/app/arl/page.tsx` component into a Next.js route-based layout with nested routes (e.g., `/arl/messages`, `/arl/tasks`). Shared state (socket handlers, meeting state, broadcast state, online counts, notifications) moves into a layout or dedicated context providers, while each view becomes its own route segment. Swipe navigation, animated transitions, and permission-based view filtering are preserved.

2. **CSP Nonce Implementation** — Replace `'unsafe-inline'` in the Content-Security-Policy header with per-request cryptographic nonces. The existing custom server (`server.ts`) and Edge middleware (`src/middleware.ts`) are extended to generate, propagate, and enforce nonces for both `script-src` and `style-src` directives.

## Glossary

- **ARL_Page**: The current monolithic page component at `src/app/arl/page.tsx` that renders 15 views via a single `activeView` state variable
- **ARL_Layout**: The new Next.js layout component at `src/app/arl/layout.tsx` that will host shared state, sidebar, header, and navigation chrome
- **ARL_View**: One of the 15 named views: overview, messages, tasks, calendar, locations, forms, emergency, users, leaderboard, remote, data-management, broadcast, meetings, analytics, tenant-settings
- **View_Router**: The Next.js App Router file-system routing that maps each ARL_View to a nested route segment under `/arl/`
- **Shared_State**: State that is consumed by multiple ARL_Views — includes socket event handlers, meeting state, broadcast state, online location count, unread message count, notification permission, push subscription, and toast queue
- **ARL_Dashboard_Context**: A new React context provider that exposes Shared_State to all ARL_View route segments
- **Swipe_Navigation**: Touch-based horizontal swipe gesture navigation between adjacent ARL_Views on mobile devices
- **Page_Indicator**: The mobile bottom navigation component that shows the current view and allows tapping to switch
- **CSP**: Content-Security-Policy HTTP response header that restricts which resources the browser may load
- **Nonce**: A unique, cryptographically random base64 string generated per HTTP request, used in CSP directives to authorize specific inline scripts and styles
- **Custom_Server**: The Node.js HTTP server defined in `server.ts` that wraps Next.js and hosts Socket.io
- **Edge_Middleware**: The Next.js middleware at `src/middleware.ts` running on the Edge runtime that handles CSRF, tenant routing, and auth redirects
- **CSP_Header**: The Content-Security-Policy header currently defined statically in `next.config.ts` via the `headers()` function

## Requirements

### Requirement 1: ARL Layout with Shared State

**User Story:** As a developer, I want the ARL page's shared state and navigation chrome extracted into a dedicated layout, so that each view can be a separate route segment without duplicating socket handlers and UI scaffolding.

#### Acceptance Criteria

1. THE ARL_Layout SHALL render the ArlSidebar, header bar, mobile Page_Indicator, OfflineIndicator, HighFiveAnimation, SocialActionsMenu, BroadcastStudio overlay, MeetingRoom overlay, task-completion toast queue, notification toast, and broadcast notification popup
2. THE ARL_Layout SHALL provide ARL_Dashboard_Context containing: activeView identifier, unread message count, online location count, active meetings list, active broadcast state, joining-meeting state, watching-broadcast state, notification permission, push subscription, toast queue, swipe direction, and sidebar-open state
3. THE ARL_Layout SHALL register socket event listeners for `task:completed`, `presence:update`, `meeting:started`, `meeting:ended`, `meeting:list`, `message:new`, `conversation:updated`, and `message:read` events and update ARL_Dashboard_Context accordingly
4. THE ARL_Layout SHALL expose a `navigateToView` function in ARL_Dashboard_Context that performs Next.js client-side navigation to the corresponding `/arl/{view}` route
5. WHEN the ARL_Layout mounts, THE ARL_Layout SHALL fetch the initial online location count from `/api/locations` and the initial unread message count from `/api/messages`
6. WHEN a `presence:update` socket event is received for a location user, THE ARL_Layout SHALL delta-update the online location count without making an HTTP request
7. WHEN a `task:completed` socket event is received, THE ARL_Layout SHALL display a toast notification with the location name, task title, and points earned, and auto-dismiss the toast after 5 seconds

### Requirement 2: Route-Based View Navigation

**User Story:** As a developer, I want each ARL_View to be a separate Next.js route segment under `/arl/`, so that the URL reflects the current view and the browser back/forward buttons work naturally.

#### Acceptance Criteria

1. THE View_Router SHALL map each ARL_View to a nested route: `/arl` (overview), `/arl/messages`, `/arl/tasks`, `/arl/calendar`, `/arl/locations`, `/arl/forms`, `/arl/emergency`, `/arl/users`, `/arl/leaderboard`, `/arl/remote`, `/arl/data-management`, `/arl/broadcast`, `/arl/meetings`, `/arl/analytics`, `/arl/tenant-settings`
2. WHEN a user navigates to `/arl`, THE View_Router SHALL render the overview dashboard as the default view
3. WHEN a user navigates to an ARL_View route, THE ARL_Layout SHALL highlight the corresponding sidebar item and update the header title
4. THE ARL_Layout SHALL derive the active view identifier from the current URL pathname rather than from component state
5. WHEN a user navigates using browser back or forward buttons, THE View_Router SHALL render the correct ARL_View without a full page reload

### Requirement 3: Permission-Based View Access Control

**User Story:** As an ARL administrator, I want views restricted by permissions to remain inaccessible to unauthorized ARLs even when navigating directly by URL, so that the permission model is enforced at the routing level.

#### Acceptance Criteria

1. WHEN an ARL user navigates to a route that requires a permission the user lacks, THE ARL_Layout SHALL redirect the user to `/arl` (overview)
2. THE ARL_Layout SHALL filter sidebar navigation items based on the user's permissions using the existing `SIDEBAR_PERM_MAP` and `VIEW_PERMISSIONS` mappings
3. THE ARL_Layout SHALL evaluate permissions using the existing `hasPermission` function, treating admin role users as having all permissions

### Requirement 4: Animated View Transitions

**User Story:** As a user, I want smooth animated transitions between views, so that navigation feels fluid and responsive on both desktop and mobile.

#### Acceptance Criteria

1. WHEN navigating between ARL_View routes, THE ARL_Layout SHALL apply a horizontal slide animation with spring physics (stiffness 300, damping 30) matching the current AnimatePresence behavior
2. THE ARL_Layout SHALL determine slide direction (left or right) based on the ordinal position of the source and destination views in the navigation item list
3. WHEN the user swipes horizontally on a mobile device, THE Swipe_Navigation SHALL trigger client-side navigation to the adjacent ARL_View route in the swipe direction
4. THE Swipe_Navigation SHALL only be active on mobile and tablet devices when the sidebar is closed

### Requirement 5: Session Persistence Migration

**User Story:** As a user, I want my active view to be remembered via the URL instead of sessionStorage, so that sharing a link or refreshing the page takes me to the correct view.

#### Acceptance Criteria

1. THE ARL_Layout SHALL remove the sessionStorage-based `arl-active-view` persistence mechanism
2. WHEN a user refreshes the browser on an ARL_View route, THE View_Router SHALL render the same ARL_View without falling back to the overview
3. WHEN a user opens a direct link to an ARL_View route (e.g., `/arl/tasks`), THE View_Router SHALL render the corresponding view

### Requirement 6: CSP Nonce Generation

**User Story:** As a security engineer, I want each HTTP response to include a unique cryptographic nonce in the CSP header, so that `'unsafe-inline'` can be removed from `script-src` and `style-src` directives.

#### Acceptance Criteria

1. THE Edge_Middleware SHALL generate a cryptographically random nonce of at least 128 bits (16 bytes) encoded as base64 for each incoming request
2. THE Edge_Middleware SHALL set the `Content-Security-Policy` response header with `'nonce-{value}'` replacing `'unsafe-inline'` in both `script-src` and `style-src` directives
3. THE Edge_Middleware SHALL set the `x-nonce` response header so that Next.js server components and the custom server can read the nonce value
4. THE Edge_Middleware SHALL retain all existing CSP directives (default-src, font-src, img-src, media-src, connect-src, frame-src, worker-src, object-src, base-uri, form-action, upgrade-insecure-requests) unchanged

### Requirement 7: Nonce Propagation to Inline Scripts and Styles

**User Story:** As a developer, I want the generated nonce to be applied to all inline `<script>` and `<style>` tags rendered by Next.js, so that the browser allows them under the nonce-based CSP.

#### Acceptance Criteria

1. THE Root_Layout SHALL read the nonce value from the request headers and pass it as the `nonce` attribute on all inline `<script>` tags, including the `dangerouslySetInnerHTML` script that blocks iOS Safari pinch-to-zoom
2. WHEN Next.js renders hydration inline scripts, THE Root_Layout SHALL propagate the nonce so that Next.js applies it to framework-generated inline scripts
3. THE CSP_Header SHALL include `https://*.sentry.io` in the `script-src` directive alongside the nonce to allow Sentry SDK loading
4. THE CSP_Header SHALL include `https://fonts.googleapis.com` in the `style-src` directive alongside the nonce to allow Google Fonts stylesheet loading

### Requirement 8: Static CSP Header Removal

**User Story:** As a developer, I want the static CSP header definition removed from `next.config.ts`, so that there is a single source of truth for CSP policy in the Edge middleware.

#### Acceptance Criteria

1. THE next.config.ts SHALL remove the `Content-Security-Policy` header from the `headers()` function return value
2. THE next.config.ts SHALL retain all other security headers (X-Content-Type-Options, X-Frame-Options, Referrer-Policy, Permissions-Policy, Strict-Transport-Security, X-XSS-Protection) in the `headers()` function
3. IF the Edge_Middleware fails to set a CSP header on a response, THEN THE Custom_Server SHALL not serve the response with `'unsafe-inline'` as a fallback

### Requirement 9: Sentry SDK Nonce Integration

**User Story:** As a developer, I want the Sentry SDK to receive the CSP nonce, so that Sentry's inline scripts are authorized by the nonce-based policy.

#### Acceptance Criteria

1. THE sentry.client.config SHALL receive the nonce value so that Sentry can apply it to any inline scripts the SDK injects
2. WHEN the Sentry SDK initializes on the client, THE Sentry SDK SHALL use the nonce for any dynamically injected inline script elements
