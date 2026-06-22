---
inclusion: always
---

# The Hub — Project Steering

Multi-tenant franchise management platform. Two UX modes: **Location Dashboard** (`/dashboard`, `/dashboard/grid`) — fullscreen kiosk, touch-only, 24/7; **ARL Hub** (`/arl`) — responsive management UI. Deployed on Railway, SQLite, single Node instance. Domain: `*.meetthehub.com`.

## Stack
Next.js 16.1.6 (App Router) · React 19 · TypeScript strict · Tailwind CSS v4 + shadcn/ui · SQLite (better-sqlite3) + Drizzle ORM · Socket.io · Framer Motion · JWT httpOnly cookie auth · `@phosphor-icons/react` v2 duotone · LiveKit · Sentry

## Hard Rules
- **Icons**: always import from `@/lib/icons` — never `lucide-react` or `@phosphor-icons/react` directly
- **API responses**: use `apiSuccess({})` and `ApiErrors.*` — never raw `NextResponse.json()`
- **Tenant isolation**: every DB query on user data needs `eq(schema.table.tenantId, tenantId)`
- **Tenant context**: from `getTenantIdFromHeaders()` in API routes; middleware resolves subdomain → cookie → /login
- **Auth**: `getAuthSession()` returns `{ userId, tenantId, userType, name, role }`. Location = `"location"`, ARL = `"arl"`
- **CSRF**: all non-GET mutations require `x-hub-request: 1` (exempt: `/api/auth/*`, `/api/session/pending`, `/api/health`)
- **Socket emit**: only via helpers in `src/lib/socket-emit.ts`, never direct `socket.emit()` from API routes
- **DB migrations**: schema change → `drizzle-kit generate` → commit SQL — never hand-edit migration files
- **No `any`**: define interfaces for all data shapes
- **No hover-only interactions** on dashboard/grid — kiosks have no hover; use `active:` states

## UI/Design Principles

**Kiosk (dashboard/grid)**
- Min 44px tap targets everywhere
- Header: `bg-background`, no border — pills float on background
- Pills: `h-9 rounded-full bg-card/80 backdrop-blur-sm shadow-sm`; logo pill is `flex-1`
- Grid: 12×12 CSS grid, `gap-3 p-3`; widgets `rounded-2xl border bg-card shadow-sm`
- Text: `text-base` for primary rows, `text-sm` for content, `text-xs` minimum for labels
- Checkboxes: `CheckCircle2` at `h-7 w-7`, same icon for done/undone — color-only change
- Live ticker: `h-9 rounded-full` pill at bottom, RAF scroll (single copy, `hasItems`-gated), LIVE badge `rounded-l-full`
- Settings panel: cog pill rotates icon only (not pill), pills morph out with `AnimatePresence`; spring `stiffness:120 damping:28`
- Header layout springs: `stiffness:100 damping:30`; `LayoutGroup id="grid-header"` coordinates cross-component layout shifts
- Clock pill hides (unmounts) when clock widget is on grid — logic inside `HeaderClock`, not header JSX
- Connection Status + Sign Out are **outside** the layout group — never animate them

**Login page**
- Flow: org entry → user ID → PIN
- Animated backgrounds: Ripple (default), Mesh, Dots, Rings, None — stored in `hub-login-bg` localStorage
- `setReloadBlocked(true)` once org resolved (PIN entry active), cleared on unmount

**Colors**: `var(--hub-red)` / `--primary` (tenant-overridable via `applyBranding()`). Use CSS variables, never hardcoded hex.

## Patterns to Avoid
- `justify-content: space-between` on layout-animated containers (pills shift right)
- Restarting RAF on `items.length` change — gate on `hasItems` only
- Mixing Tailwind `translate-*` with RAF `style.transform` on same element
- Hardcoded tenant IDs/slugs

## Key File Locations
- `src/lib/icons.tsx` — icon exports (single source of truth)
- `src/lib/db/schema.ts` — Drizzle schema (40+ tables)
- `src/lib/socket-emit.ts` — socket helpers
- `src/lib/reload-guard.ts` — build-update reload protection
- `src/lib/api-helpers.ts` — `getAuthSession`, `getTenantIdFromHeaders`
- `src/lib/api-response.ts` — `apiSuccess`, `ApiErrors`
- `src/lib/task-utils.ts` — shared `taskAppliesToday()` (do not duplicate)
- `src/lib/timezone.ts` — tenant-aware timezone helpers (`tzNow`, `tzTodayStr`, etc.)
- `src/app/dashboard/grid/page.tsx` — grid dashboard + `GridTickerBar` + `HeaderClock`
- `src/components/dashboard/grid/grid-dashboard.tsx` — `SettingsPanel`, `GridControls`, `GridSurface`

## Deployment
Railway auto-deploys `main`. Build ID written to `build-id.txt` (`RAILWAY_GIT_COMMIT_SHA`). Socket broadcasts `build:id` on connect; clients auto-reload on mismatch (guarded by `reload-guard.ts`). Always push directly to `main`. Sentry auth token is currently expired (source maps fail but build succeeds).

## Known Debt (don't regress)
- Rate limiter is in-memory — resets on deploy
- `meeting-room-livekit-custom.tsx` ~1500 lines, not yet refactored
- Test coverage ~5% — don't remove existing tests
- JSON columns need null-safe parsing at every read site
