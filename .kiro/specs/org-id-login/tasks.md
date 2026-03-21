# Implementation Plan: Organization ID Login

## Overview

This plan adds an org ID entry step to the login page, updates the middleware to resolve tenants from a cookie on the root domain, and persists the selection in localStorage + cookie. The IP-based association (Requirement 6) is a separate phase at the end.

## Tasks

- [x] 1. Add `resolveTenantBySlug` helper and `/api/auth/resolve-org` endpoint
  - [x] 1.1 Add `resolveTenantBySlug(slug: string)` function to `src/lib/tenant.ts`
    - Case-insensitive lookup: query `tenants` table where `slug = slug.toLowerCase()`
    - Return `{ id, slug, name, logoUrl, primaryColor, accentColor, faviconUrl, appTitle, isActive }` or null
    - Only return active tenants (`isActive = true`)
    - _Requirements: 2.1, 2.2_

  - [x] 1.2 Create `src/app/api/auth/resolve-org/route.ts`
    - POST handler that accepts `{ slug: string }` in the request body
    - Validate slug is 2–10 alphanumeric characters (reject with 400 otherwise)
    - Rate-limit: 10 attempts per IP per 60s using existing `checkRateLimit`
    - Call `resolveTenantBySlug(slug)` — return tenant branding on success, 404 on failure
    - Response shape: `{ ok: true, tenant: { id, slug, name, logoUrl, primaryColor, accentColor, faviconUrl, appTitle } }`
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_

- [x] 2. Update middleware to support cookie-based tenant resolution on root domain
  - [x] 2.1 Import `resolveTenantBySlug` into `src/middleware.ts` (or inline equivalent for Edge runtime)
    - Note: The middleware runs on Edge runtime. If `resolveTenantBySlug` uses Drizzle ORM which may not be Edge-compatible, inline a direct DB query or use the existing `extractTenantSlug` pattern with a slug-based lookup
    - _Requirements: 7.2_

  - [x] 2.2 Update the root domain handler in `middleware()`
    - Current behavior: root domain redirects everything except `/`, `/landing`, `/_next`, and static files to `/`
    - New behavior:
      - Read `x-org-id` cookie from the request
      - If cookie exists, resolve tenant by slug. If valid, inject `x-tenant-id` and `x-tenant-slug` headers and continue with the same auth/routing logic as the subdomain flow
      - If cookie exists but slug is invalid/inactive, clear the cookie and redirect to `/login`
      - If no cookie, allow public paths (`/login`, `/api/auth/*`, `/_next`, static files) without tenant context
      - If no cookie and path is protected, redirect to `/login`
    - Keep the landing page (`/`) accessible without a cookie
    - _Requirements: 7.1, 7.2, 7.3, 7.4_

  - [x] 2.3 Add `/api/auth/resolve-org` to the CSRF-exempt paths list
    - The resolve-org endpoint is a public POST that doesn't need the `x-hub-request` CSRF header
    - _Requirements: 2.1_

- [x] 3. Add org entry screen to the login page
  - [x] 3.1 Add org-related state variables to `src/app/login/page.tsx`
    - `orgSlug: string | null` — the validated org slug (null = show org entry)
    - `orgInput: string` — current text in the org input field
    - `orgError: string` — error message for org validation
    - `orgLoading: boolean` — loading state during API call
    - `resolvedTenant: { id, slug, name, logoUrl, primaryColor, accentColor, faviconUrl, appTitle } | null`
    - `showOrgKeyboard: boolean` — default `true` for kiosk-first UX
    - `orgChecked: boolean` — whether the initial localStorage check has completed
    - _Requirements: 1.1, 1.3_

  - [x] 3.2 Add `useEffect` to check localStorage on mount
    - On mount, read `hub-org-id` from localStorage
    - If found, call `/api/auth/resolve-org` to validate it's still active
    - If valid: set `orgSlug`, `resolvedTenant`, apply branding, set `orgChecked = true`
    - If invalid: clear localStorage, set `orgChecked = true`, show org entry screen
    - If no stored value: set `orgChecked = true`, show org entry screen
    - _Requirements: 1.2, 5.2, 5.3_

  - [x] 3.3 Add `handleOrgSubmit` function
    - Validate `orgInput` is ≥2 characters (show error if not)
    - Call `POST /api/auth/resolve-org` with `{ slug: orgInput }`
    - On success: set `orgSlug`, `resolvedTenant`, save to localStorage (`hub-org-id`), set cookie (`x-org-id`), apply tenant branding via `applyBranding()`
    - On 404: show "Organization not found" error
    - On 429: show "Too many attempts" error
    - On network error: show "Connection error" message
    - _Requirements: 2.2, 2.3, 2.4, 5.1_

  - [x] 3.4 Render the Org Entry Screen UI
    - Show when `orgChecked === true && orgSlug === null`
    - Generic Hub branding (logo + "Welcome to The Hub")
    - Text input: uppercase, maxLength 10, `readOnly` when virtual keyboard is visible
    - Virtual keyboard toggle button (keyboard icon)
    - `VirtualKeyboard` component with `onKeyPress` appending to `orgInput`, `onBackspace` removing last char, `onEnter` calling `handleOrgSubmit`
    - Error message display
    - Loading spinner during validation
    - _Requirements: 1.1, 1.4, 4.1, 4.2, 4.3, 4.4, 4.5_

  - [x] 3.5 Add "Change Organization" control to the login type selection screen
    - Small link/button below the login type buttons: "Not {tenantName}? Change organization"
    - On click: clear cookie, clear localStorage, reset `orgSlug`, `resolvedTenant`, `loginType`, `pin`
    - _Requirements: 3.4, 5.4_

  - [x] 3.6 Apply tenant branding after org resolution
    - Use the `resolvedTenant` data to show tenant logo, name, and primary color
    - Call the existing `applyBranding()` function (from tenant-context.tsx) or replicate its CSS variable injection
    - Display tenant name prominently above the PinPad
    - Update favicon if tenant has one
    - _Requirements: 8.1, 8.2, 8.3_

  - [x] 3.7 Pass tenant ID with login request
    - Update the `handlePinSubmit` function to include the resolved tenant slug in the login API call
    - The middleware will already have `x-tenant-id` set from the cookie, but sending it explicitly ensures correctness
    - _Requirements: 3.1, 3.2, 3.3_

- [x] 4. Checkpoint — verify core flow works end-to-end
  - Test: visit root domain → see org entry → type org → see branding → login type → PIN → authenticated
  - Test: revisit → org is remembered → skip to login type
  - Test: "Change Organization" → returns to org entry
  - Test: invalid org → error message
  - Test: subdomain still works as before

- [x] 5. IP-based organization association (Requirement 6 — optional phase)
  - [x] 5.1 Create database migration for `org_ip_mappings` table
    - Columns: `id` (TEXT PK), `tenant_id` (TEXT FK→tenants), `ip_address` (TEXT UNIQUE), `created_by` (TEXT FK→arls), `created_at` (TEXT)
    - Add to `src/lib/db/schema.ts`
    - Generate migration via drizzle-kit
    - _Requirements: 6.1_

  - [x] 5.2 Create `GET /api/auth/resolve-org-by-ip` endpoint
    - Reads client IP via `getClientIP(req.headers)`
    - Looks up `org_ip_mappings` for a matching IP
    - If found, returns the associated tenant's branding (same shape as resolve-org)
    - If not found, returns `{ ok: false }`
    - _Requirements: 6.2_

  - [x] 5.3 Create admin API endpoints for IP mapping management
    - `GET /api/admin/ip-mappings` — list all mappings for the current tenant
    - `POST /api/admin/ip-mappings` — create a new mapping `{ ipAddress, tenantId }`
    - `DELETE /api/admin/ip-mappings/[id]` — remove a mapping
    - All require ARL or admin authentication
    - _Requirements: 6.1, 6.4_

  - [x] 5.4 Update login page to check IP association on load
    - Before checking localStorage, call `GET /api/auth/resolve-org-by-ip`
    - If IP mapping found, use it as the org (takes priority over localStorage per Req 6.3)
    - If not found, fall through to localStorage check
    - _Requirements: 6.2, 6.3_

## Notes

- Task 5 (IP association) is fully optional and can be deferred to a later sprint
- The existing subdomain flow is preserved — this is additive, not a replacement
- The `x-org-id` cookie is long-lived (1 year) since kiosks rarely clear cookies
- The virtual keyboard defaults to visible (kiosk-first), matching the existing pattern in the guest login flow
