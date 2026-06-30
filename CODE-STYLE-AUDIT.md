# Code Style Audit — 2026-06-28 (re-run)

No code changes were made as part of this audit — findings only. This
document is the implementation-pattern counterpart to [DESIGN.md](DESIGN.md)
and the existing audit series ([ARL-AUDIT.md](ARL-AUDIT.md),
[DASHBOARD-AUDIT.md](DASHBOARD-AUDIT.md), [APP-AUDIT.md](APP-AUDIT.md)):
where those documents cover visual and UX consistency, this one covers
*code-level* consistency — the same problem solved differently in different
files because different sessions each picked their own convention, not
because anyone decided to vary it.

**2026-06-30 update — Section 2's Card/Dialog/Badge/Avatar findings are
resolved, not historical numbers.** A later session ran adoption sweeps for
all four, converting the genuine hand-rolled candidates (filtering out
false positives — table rows, dropdown panels, confirm-dialog.tsx's own
established pattern, etc. — see commit history on `main` for the per-file
reasoning). Current import counts: Card 13 (was 0), Dialog 9 (was 1), Badge
13 (was 2), Avatar 6 (was 0). §6a's migration-endpoint routes are also
confirmed deleted. The rest of this document (animation, data fetching,
socket handling, TypeScript, file organization) was not re-verified as part
of that pass and may still reflect 2026-06-28 reality — re-run before
trusting those sections.

**This is a full re-run, not an edit of the prior version.** The codebase
changed substantially after the initial audit was written (02:08 on
2026-06-28): a separate session executing `ARL-AUDIT.md` touched ~41 files,
extracted four new shared UI primitives (`status-dot`, `destructive-icon-
button`, `empty-state`, `modal-close-button`), migrated the `ui/` overlay
primitives (`dialog`, `select`, `menu`) onto Ark UI, and fixed many of the
specific issues the prior audit named. Every count below reflects current
code, not the prior document — treat any earlier version of this file as
historical, not a baseline to diff against.

**What this audit does not cover:** anything already in DESIGN.md. Section 9
(Motion) and Section 15 (Component Consistency) address the *visual*
decisions; this audit covers the *implementation* of those decisions.

## Scope

- `src/components/` — 106 component/hook files across ARL console, kiosk
  dashboard, shared, meeting-room, and `ui/` primitives
- `src/app/` — Next.js page components and 98 API route files
- `src/hooks/` — 7 custom hooks
- `src/lib/` — context providers, utilities, socket handlers

---

## Summary

| Dimension | Verdict | Drift severity |
|---|---|---|
| 1. Animation implementation | Improved — the `initial`-prop bug is **fixed**; two new dead-code artifacts | **Low** (was High) |
| 2. Shared UI primitive adoption | **Resolved 2026-06-30** — Card/Avatar/Dialog/Badge adoption sweeps completed (see update note above); 4 new primitives' ARL-only gap not re-verified | ~~High~~ → Low (unverified for the ARL-only gap) |
| 3. Data fetching & async state | Improved in ARL but still inconsistent — error feedback is now mixed *within* files; `AbortController` still 0/47 | **High** |
| 4. Socket event handling | Clean — consistent and correct everywhere | None |
| 5. TypeScript conventions | Mostly clean — `any` is the only drift; ARL fix introduced new `err: any` | Low |
| 6. API route conventions | Mostly clean — same 2 legacy routes + 1 logout path remain | Low |
| 7. File organization & naming | Clean — 100% consistent on every checked dimension | None |

---

## 1. Animation Implementation

### 1a. Mechanism inventory

| Mechanism | File count | Role in this codebase |
|---|---|---|
| Framer Motion (`motion.*`) | 54 | Entrance/exit and state transitions |
| `AnimatePresence` | 39 | Mount/unmount animation orchestration |
| CSS `transition-*` Tailwind classes | 73 | Press-state color/opacity changes |
| Tailwind `animate-*` utilities | 39 | Looping states: pulse, spin, ping |
| CSS `@keyframes` | 1 | `src/app/globals.css:209` — keyboard slide-up |
| `requestAnimationFrame` | 5 | Continuous media loops (audio meter, video) |

**Verdict: Deliberate.** The split remains coherent — each mechanism is used
for what it is best suited to. The single `@keyframes` in `globals.css` (now
line 209) still predates the Framer Motion investment and hasn't been
migrated — minor, not meaningful drift. No mechanism overlap for the same
job.

### 1b. Framer Motion: missing `initial` props — **the bug is fixed**

**The 20+ entrance-transition instances the prior audit flagged are gone.**
Every `animate={{ opacity: 1, y: 0 }}` element previously missing its
`initial` counterpart now has one. Spot-confirmed:

- `overview-dashboard.tsx:182` → `initial={{ opacity: 0, y: -10 }}`
- `tenant-settings.tsx:234` → `initial={{ opacity: 0, y: 10 }}`
- `user-management.tsx:568` → `initial={{ opacity: 0 }}` … `exit`
- `admin/page.tsx:227` → `initial={{ opacity: 0, y: 20 }}`
- `arl-sidebar.tsx:93` (`motion.aside`) →
  `initial={isMobileOrTablet ? { x: -280 } : false}` (the correct
  `initial={false}` idiom for the no-mount-animation case)

A full-tree scan for `<motion.*>` tags (multi-line aware) with `animate` but
no `initial`/`variants` returns **22 elements; 0 are entrance transitions.**
All 22 are legitimately `initial`-free:

- **15 looping animations** (`repeat: Infinity`) — pulse/shimmer/glow:
  `notification-bell.tsx:386,392`, `animated-background.tsx:28,51`,
  `skeleton.tsx:37`, `emergency-overlay.tsx:200,207`,
  `emergency-broadcast.tsx:197`, `locations-manager.tsx:148,149,156,158,159`,
  `socket-context.tsx:274,303`.
- **7 state-driven animations** (animate on state change, not mount) —
  correctly `initial`-less: `login/page.tsx:628` (fill toggle),
  `login/page.tsx:943` (`key={shakeKey}` PIN-error shake),
  `login/page.tsx:1055` (self-ping button), `meeting/page.tsx:919` (fill
  state), `shake.tsx:31` (shake primitive), `grid-dashboard.tsx:214`
  (`rotate: open ? 90 : 0` chevron), `remote/cursor-overlay.tsx:49`
  (`x: cx, y: cy` cursor tracking).

**Verdict: Resolved — no longer drift.** This was the prior audit's #1
bug-level finding; it has been comprehensively fixed.

### 1c. Framer Motion: duration and easing — constants file created but **never imported**

`src/lib/motion.ts` now exists and exports the exact `MOTION` constant the
prior audit recommended (`fast`/`normal`/`slow`/`loop.shimmer`/`loop.pulse`).
**It is imported by 0 files.** It is dead code, exactly like `useSwrFetch`.

Inline values remain hand-typed across 54 files. Current inventory:

Duration values (occurrences): `0.15` ×11, `0.18` ×1, `0.2` ×7, `0.25` ×2,
`0.28` ×1, `0.3` ×1, `0.4` ×2, `0.45` ×1, `0.5` ×6, `0.6` ×3, `0.8` ×3, `0.9`
×1, `1.0` ×1, `1.2` ×8, `1.5` ×4, `1.6` ×1, `3.0` ×1, `20` ×1, `0.1` ×1,
`0.12` ×1.

Easing values (occurrences): `"easeInOut"` ×18, `"easeOut"` ×12, `"linear"`
×1, `[0.32, 0.72, 0, 1]` ×1 (custom bezier, `restaurant-chat.tsx`).

The micro-interaction range (`0.12`–`0.5`) still has no agreed tiers in
practice; files on the same surface use `0.2`, `0.25`, and `0.3`
interchangeably.

**Verdict: Accidental drift, now with an unused remedy in the repo.** The
fix was authored but never wired up. The correct close-out is to either
adopt `MOTION` codebase-wide or delete it; the current state (a correct
constants file, zero usage) is the worst of both.

### 1d. Skeleton/loading: largely consolidated, residual `animate-pulse` blocks

The shared `<Skeleton>` at `src/components/ui/skeleton.tsx` was upgraded —
it now uses a **gradient shimmer**
(`bg-gradient-to-r from-muted via-muted-foreground/10 to-muted` with
`animate={{ x: [...] }}`, lines 37–46) and a `variant` prop
(`default`/`card`/`list`/`text`/`avatar`). This is the same visual that
`locations-manager` hand-rolled, so the visual fork the prior audit noted is
now closable. It is imported in **6 files** (`restaurant-chat`,
`arl/messaging`, `arl/task-manager`, `arl/forms-repository`,
`arl/user-management`, `arl/remote-login`).

Residual hand-rolled loading placeholders that should be
`<Skeleton variant="card">`:

| File | Line(s) | Instances |
|---|---|---|
| `src/app/arl/layout.tsx` | 287, 290–292, 295–296 | 6 |
| `src/components/arl/overview-dashboard.tsx` | 127, 131, 132 | 3 |
| `src/components/arl/analytics-dashboard.tsx` | 307, 309 | 2 |

`meeting-analytics.tsx` and `data-management-health.tsx` (prior offenders)
no longer hand-roll loading skeletons. `locations-manager.tsx:148–159` still
contains 5 inline `motion.div` gradient shimmers — these now match
`Skeleton`'s visual exactly and should be replaced with it.

Non-drift `animate-pulse` (live status indicators, not loading placeholders,
correctly left inline): `voice-recorder.tsx:137`, `notification-bell.tsx:436,447`,
`meeting/page.tsx:579,638`, `grid-upcoming.tsx:141`, `remote-viewer.tsx:375`,
`status-dot.tsx` (the primitive itself).

**Verdict: Accidental drift, much reduced.** ~11 hand-rolled placeholders
remain across 3 files, plus the 5 `locations-manager` shimmers.

### 1e. AnimatePresence usage — consistent

39 files use `AnimatePresence`, appropriately distributed across modals,
dropdowns, alerts, list items, and conditional panels. No meaningful
missing-`AnimatePresence` cases found.

**Verdict: Deliberate and consistent.** No action needed.

---

## 2. Shared UI Primitive Adoption

`src/components/ui/` now contains **21 primitives** (was 15): `avatar`,
`badge`, `button`, `card`, `destructive-icon-button` *(new)*, `dialog`,
`emoji`, `empty-state` *(new)*, `icon-tip`, `input`, `label`, `menu` *(new)*,
`modal-close-button` *(new)*, `scroll-area`, `select` *(new)*, `shake`,
`skeleton`, `status-dot` *(new)*, `success-checkmark`, `tabs`, `textarea`.

`dialog`, `select`, and `menu` are now thin wrappers over **Ark UI**
(`@ark-ui/react`) with `Portal` wrappers and generic typing
(`select.tsx:21` — `Select<T extends CollectionItem>`). This gives them
real focus management, `aria-modal`, and keyboard plumbing for free —
making the near-zero `Dialog` adoption (§2c) a more acute accessibility gap
than before.

| Primitive | Import sites | Hand-rolled equivalents | Adoption |
|---|---|---|---|
| `Button` | 20 | ~327 raw `<button>` total (most legitimate) | Low |
| `Badge` | 2 | ~57 inline chips/pills | Very low |
| `Card` | **0** | ~68 card-like divs | **None** |
| `Input` | 16 | ~3 raw inputs | Good |
| `Dialog` | **1** | ~10 true modal overlays | **Near zero** |
| `Select` *(new)* | 7 | — | Good (ARL only) |
| `Menu` *(new)* | 6 | — | Good (ARL only) |
| `Tabs` | 6 | 0 | Good |
| `Skeleton` | 6 | ~11 hand-rolled (§1d) | Partial |
| `Textarea` | 1 | 3 raw textareas | Very low |
| `Avatar` | **0** | ~70 `rounded-full` initials/img | **None** |
| `StatusDot` *(new)* | 6 | several inline dots outside ARL | Good (ARL only) |
| `DestructiveIconButton` *(new)* | 2 | inline delete buttons | Partial (ARL only) |
| `EmptyState` *(new)* | 7 | inline "nothing here" blocks | Good (ARL only) |
| `ModalCloseButton` *(new)* | 9 | inline "X" buttons | Good (ARL only) |

### 2a. The four new primitives — well-adopted, but ARL-only

The ARL session extracted and adopted four primitives that didn't exist at
the last audit:

- **`StatusDot`** (6 imports): `arl/layout.tsx`, `overview-dashboard`,
  `locations-manager`, `messaging`, `broadcast-launcher`,
  `emergency-broadcast`. Canonical `h-2 w-2` dot with semantic colors +
  `pulse`.
- **`DestructiveIconButton`** (2 imports): `ticker-push`,
  `forms-repository`. (`swipeable-convo-row.tsx` deliberately excluded per
  its own header comment.)
- **`EmptyState`** (7 imports): `messaging`, `locations-manager`,
  `forms-repository`, `user-management`, `scheduled-meetings`,
  `remote-viewer`, `data-management-audit-log`.
- **`ModalCloseButton`** (9 imports): `arl-sidebar`, `locations-manager`,
  `ticker-push`, `forms-repository`, `user-management`,
  `notification-settings-panel`, `data-management-audit-log`,
  `task-form-modal`, `emergency-broadcast`. (`broadcast-launcher`/
  `broadcast-studio` deliberately excluded — colored-header contrast.)

**Every importer of all four is under `src/components/arl/`.** The patterns
these replace also exist outside ARL — e.g. status dots in
`dashboard/restaurant-chat.tsx:702`, `grid-calendar.tsx:294`, close buttons
across meeting-room dialogs and `notification-panel.tsx`, empty states
across `dashboard/` grid components. Those have not been migrated. See
APP-AUDIT.md Finding 9 for the project-wide view of this same gap.

**Verdict: Deliberate within ARL (clean adoption), accidental drift outside
it.** The primitives are correct and used well where they were born; the
rest of the codebase still hand-rolls the same patterns. These should be
promoted from "ARL primitives" to "app primitives."

### 2b. Card — RESOLVED 2026-06-30 (13 import sites, was 0)

**0 files import the `Card` primitive.** ~68 card containers (matching
`rounded-2xl/-xl border … bg-card`) are built from raw divs — **52 of them
in `src/components/arl/`** alone, the rest across `landing-page.tsx`,
`global-search.tsx`, dashboard grid, and meeting components. The ARL
session did not adopt `Card` even while heavily editing ARL files.

**Verdict: Accidental drift.** Restyling the card surface still requires
~68 grep-and-replace operations.

### 2c. Dialog — RESOLVED 2026-06-30 (9 import sites, was 1)

**1 file imports `Dialog`** (`arl/group-info-modal.tsx`). The Dialog
primitive is now Ark-UI-backed (real `aria-modal`, focus trap, portal,
escape). ~10 true modal dialogs still use raw `fixed inset-0 z-50`,
bypassing all of it:

`task-form-modal.tsx` · `data-management.tsx:479` · `meeting-analytics.tsx`
· `broadcast-launcher.tsx` · `broadcast-studio.tsx` · `user-management.tsx`
· `forms-repository.tsx` · `meeting-room/rename-dialog.tsx` ·
`app/admin/page.tsx` · `app/login/page.tsx` (PIN overlay).

Deliberately not `Dialog` (slide-in panels / fullscreen takeovers / command
palettes): `notification-panel.tsx`, `arl/notification-settings-panel.tsx`,
`dashboard/emergency-overlay.tsx`, `arl/remote-viewer.tsx`,
`global-search.tsx`.

**Verdict: Accidental drift for the ~10 true modal cases**, now
higher-impact because the primitive provides accessibility the hand-rolled
overlays lack.

### 2d. Badge — RESOLVED 2026-06-30 (13 import sites, was 2)

**2 files import `Badge`** (`task-virtual-list.tsx`, `group-info-modal.tsx`).
~57 inline status chips / count badges use `rounded-full text-xs` (26 in
ARL, 31 elsewhere: `app-header`, `notification-bell`, meeting-room panels,
`landing-page`, dashboard grid).

**Verdict: Accidental drift.** Same root cause as Card.

### 2e. Avatar — RESOLVED 2026-06-30 (6 import sites, was 0)

**0 files import the `Avatar` primitive.** ~70 avatar-style
`rounded-full … items-center justify-center` elements (initials badges,
profile circles) exist across meeting-room, messaging, dashboard, and ARL.

**Verdict: Accidental drift.**

### 2f. Button, Textarea — partial adoption, clear substitution cases

**Button** (20 imports): The ~327 raw `<button>` total is dominated by
legitimate raw buttons (toggles, segmented controls, calendar chevrons).
The clear substitution cases (icon-only close/back → `variant="ghost"
size="icon"`) persist, though many ARL close buttons were instead migrated
to the new `ModalCloseButton`, which is the better fit.

**Textarea** (1 import): 3 raw textareas that are direct substitutes remain
— `ticker-push.tsx`, `task-form-modal.tsx`, `emergency-broadcast.tsx`.

**Verdict for substitution cases: Accidental drift.**

### 2g. Input good; Tabs / Select / Menu now well-adopted

**Input** (16 imports, ~3 specialized raw inputs) — not significant drift.
**Tabs** (6 imports, was 1) — adopted across `arl/meetings`,
`tenant-settings`, `remote-management`, `analytics-dashboard`,
`user-management`, `remote-login`; no hand-rolled tabs. **Select** (7) and
**Menu** (6) — newly created and adopted, all in ARL.

**Verdict: No drift** for these four.

---

## 3. Data Fetching & Async State

### 3a. Fetch mechanism — single pattern, one still-dead hook

47 client files use the manual `useState` + `useEffect` + `fetch` pattern.
No `axios`. **`useSwrFetch` (`src/hooks/use-swr-fetch.ts`) is still imported
nowhere — still dead code.** It still implements correct unmount-safe
cleanup via `mountedRef` (lines 53, 73, 77, 90, 92) that the manual pattern
omits everywhere else (§3c).

**Verdict:** Unchanged from prior audit. Adopt `useSwrFetch` (and its
cleanup) or delete it.

### 3b. Error handling — improved in ARL, now mixed *within* files

The prior audit's "88% silent" figure has changed. The ARL session added
user-visible error state to several files, but typically only on the
*mutation/destructive* paths, leaving the *initial list-fetch* catch blocks
still console-only or silent — so the inconsistency moved from being
*between* files to being *within* files.

Concrete examples of the new within-file split:
- `arl/forms-repository.tsx`: the list fetch catch (`:99`) still only
  `console.error`s; the delete path (`:145,148`) now sets `listError`.
  Upload errors (`:127`) still console-only.
- `arl/locations-manager.tsx`: now has `listError` (`:60`) and `pinError`
  (`:58`), with `setPinError("Network error")` on the PIN path (`:96`) —
  but the main fetch catch (`:69`) and another (`:112`) are silent.
- `arl/data-management.tsx`: fully consistent — sets `error` state in
  every catch (`:57,73,161,175,227,243`).

Empty (`catch {}` / `.catch(() => {})`) catch blocks across non-API code:
**62**. Highest concentrations:
- `dashboard/restaurant-chat.tsx` — 13 (`:151,193,230,259,281,302,322,355,371,500,839,913` + …)
- `arl/use-messaging.ts` — 11 (`:65,86,106,126,137,166,176,349,378,403,417`)
- `notification-bell.tsx` — 6 · `dashboard/emergency-overlay.tsx` — 5 ·
  `lib/arl-dashboard-context.tsx` — ~7 · `lib/mirror-context.tsx` — 4 (all
  `window.close()` guards — legitimate) · `lib/sound-effects.ts` — 5 (audio
  autoplay — legitimate) · `lib/db/index.ts` — ~30 (idempotent
  `ALTER TABLE` migration guards — legitimate).

`console.error`-only catches across components/app (non-API): 19 files; 25
occurrences in ARL specifically (`analytics-dashboard`, `overview-dashboard`,
`locations-manager`, `tenant-settings`, `task-manager`, `meeting-analytics`,
`group-info-modal`, `forms-repository`, `notification-tester`,
`user-management`, `notification-settings-panel`, `task-form-modal`).

Sets-error-state files (user sees failure): `arl/data-management.tsx`,
`arl/tenant-settings.tsx`, `arl/user-management.tsx`, `arl/remote-login.tsx`,
`arl/forms-repository.tsx` (partial), `arl/locations-manager.tsx`
(partial), plus `lib/tenant-context.tsx`, `meeting-room-livekit-custom.tsx`.

**Verdict: Accidental drift, improved but not resolved.** There is still no
consistent philosophy. The canonical model is `data-management.tsx` (set
error state in every catch). Note the ARL fix introduced
`catch (err: any)` (5 in `data-management.tsx`) rather than the prior
audit's recommended `catch (err: unknown)` — a small step backward on
typing (see §5e).

### 3c. AbortController / unmount cleanup — still universally missing

**0 of 47 client fetch files use `AbortController`.** No `signal:` in any
component/page fetch; no `mountedRef`/`isMounted` outside the dead
`useSwrFetch`. Every `useEffect` that calls `fetch` still has no cleanup.
This is unchanged and remains codebase-wide.

**Verdict: Accidental drift — universal.** Still the strongest bug-level
candidate.

### 3d. Async style — `.then()` and `async/await` mixed in 3 files

Most files use `async/await`. The same three files still mix both within
one component:
- `src/app/dashboard/page.tsx` — 4 `.then(` chains amid otherwise async/await
- `src/lib/arl-dashboard-context.tsx` — 4 `.then(` chains
- `src/components/arl/notification-tester.tsx` — `.then()` at lines 44–45

**Verdict: Accidental drift.** Unchanged. `async/await` is canonical.

### 3e. Loading state naming — acceptable split

| Name | Count |
|---|---|
| `loading` | 26 |
| `sending` | 6 |
| `saving` | 6 |
| `deleting` | 2 |
| `uploading` | 1 |
| `processing` | 1 |
| `pinSaving` | 1 |
| `clearing` | 1 |
| `activating` | 1 |
| `isLoading` | 1 (`group-info-modal.tsx` — minor drift) |

**Verdict:** Semantic-action names are deliberate. The single `isLoading`
outlier is trivial. No action beyond standardizing on `loading` for generic
single-fetch cases.

---

## 4. Socket Event Handling

### 4a. Cleanup — still correct and consistent everywhere

Across 33 files containing `socket.on`, every component- and
client-context-level subscription has a matching `socket.off` in the
`useEffect` cleanup. Per-file `on`/`off` balance verified — all balanced
(the one apparent `6/5` in `notification-bell.tsx` is two `off`s on one
line; all 6 subscriptions are cleaned). Highest-subscription files all
correct: `meeting-room-livekit-custom.tsx` (23/23), `dashboard/page.tsx`
(11/11), `arl/remote-viewer.tsx` (11/11), `lib/mirror-context.tsx` (11/11),
`lib/arl-dashboard-context.tsx` (8/8).

Server-side `socket.on` in `lib/socket-server.ts` and
`lib/socket-handlers/*` is connection-scoped and correctly not paired with
`useEffect`-style `off`.

**Verdict: Deliberate and clean.** Still the strongest consistency finding
in the codebase. No action needed.

---

## 5. TypeScript Conventions

### 5a. `interface` vs `type` — consistent and correct

- **160 `interface` declarations**, **26 `type` declarations** across
  `src/`.
- `interface` for all component props and data/payload shapes; `type` only
  for unions/literals, mapped/inferred types, and structural aliases.
- **0 `enum` declarations** — exclusively `as const` and union strings.

**Verdict: No drift.**

### 5b. FC / React.FC — zero usage

**0 files use `React.FC<Props>` or `FC<Props>`.** All components are plain
function declarations.

**Verdict: No drift.**

### 5c. Export conventions — correct for context

`export default function` — 27 occurrences, exclusively Next.js `src/app/`
pages. Named exports everywhere else. UI primitives use named export
blocks.

**Verdict: No drift.**

### 5d. Prop type definition style — acceptable split

Inline anonymous prop objects for the new ARL primitives (`StatusDot`,
`EmptyState`, `DestructiveIconButton`, `ModalCloseButton` all use inline
`{ ... }` prop types — consistent with the codebase's "private/simple
component → inline" rule). Named `interface` above the function for
exported, multi-prop components. The split tracks complexity, not
randomness.

**Verdict: No drift, but worth documenting the implicit rule** (named
`interface` when exported or ≥4 props; inline otherwise).

### 5e. `any` usage — ~166 explicit occurrences, slightly up

| Pattern | Occurrences |
|---|---|
| `: any` annotations | 79 |
| `as any` assertions | 82 |
| `<any>` / `, any>` generics | 5 |

Highest-count files: `lib/socket-server.ts` (28 — Socket.io property
attachment; still fixable with one type augmentation), `lib/remote-capture.ts`
(14 — non-standard RTC properties), `lib/socket-handlers/tests.ts` (8 — test
data), `arl/data-management.tsx` (**7 — new this cycle**),
`api/data-management/integrity-check/route.ts` (7 — SQLite results),
`meeting-room-livekit-custom.tsx` (6),
`lib/socket-handlers/{meetings,broadcasts}.ts` (6 each).

**New regression:** the ARL error-handling fix added `catch (err: any)` in
`data-management.tsx` (5 occurrences) instead of the canonical
`catch (err: unknown)`. Small, but it's lazy typing introduced after the
prior audit recommended against it.

Other lazy-typing instances persist (SQL `params: any[]`, icon-map
`Record<string, any>`, socket emit `data: any`).

**Verdict: Mixed.** Most `any` is a legitimate third-party-boundary escape
hatch; the `socket-server.ts` block and the new `data-management.tsx`
catches are the clearest fix targets.

---

## 6. API Route Conventions

### 6a. Auth session check — consistent

98 route files. `getAuthSession()` used in 77 protected routes;
`getSession()` directly in 7 session-management routes (deliberate — no
tenant wrap needed); 8 public endpoints correctly skip auth;
`health/route.ts` public. The **2 unprotected migration endpoints**
(`migrate-users/route.ts`, `admin/migrate-4digit/route.ts`) flagged here and
escalated to CRITICAL in AUDIT.md §3.1 are **RESOLVED as of 2026-06-30 —
both routes deleted**, not just protected.

**Verdict: Deliberate throughout.**

### 6b. Response helper adoption — same three holdouts

`apiSuccess` / `ApiErrors` (`src/lib/api-response.ts`) imported in 91 route
files. The same three legacy-shape offenders remain, unchanged:
- `src/app/api/messages/groups/[id]/members/route.ts` — ~10 hand-rolled
  `{ error: "…" }` / `{ success: true, … }` (lines 23, 44, 97, 104, 126,
  146, 157, 176, 197, …)
- `src/app/api/messages/groups/[id]/leave/route.ts` — 6 hand-rolled
  responses (lines 27, 48, 73, 82, 86, …)
- `src/app/api/auth/logout/route.ts:43–45` — one
  `{ error: "Internal server error" }` in the catch block

Deliberate non-adopters (cookie-setting auth routes, `emergency`, `health`,
migrations) unchanged.

**Verdict: Accidental drift in the same two messages/groups routes and one
logout error path.** Canonical: `ApiErrors.*` / `apiSuccess(...)`.

### 6c. HTTP method exports and error handling — consistent

All routes use `export async function GET/POST/PUT/PATCH/DELETE()`;
protected routes have top-level `try/catch` returning `ApiErrors.internal()`;
status codes flow through `ApiErrors`.

**Verdict: No drift.**

---

## 7. File Organization & Naming

| Dimension | Pattern | Outliers |
|---|---|---|
| Component filenames | `kebab-case.tsx` throughout | None |
| `"use client"` placement | Line 1, before all imports | None (7 Ark-UI primitives omit the trailing `;` — cosmetic, still line 1) |
| Type/interface co-location | Inline; shared `types.ts` for cross-file domain types | None |
| API route naming | `route.ts` with bracket dynamic segments | None |
| API route organization | Domain-grouped under `src/app/api/` | None |
| Export convention | `export default` for pages; named exports elsewhere | None |

No `src/types/` directory; types co-located. The two domain type files
(`meeting-room/types.ts`, `socket-handlers/types.ts`) remain appropriate.

**Verdict: No drift on any dimension.** Still the cleanest area in this
audit.

---

## Findings by priority

### Bug-level: fix before next release

1. **No `AbortController` cleanup on any `useEffect` fetch** — 47 files,
   universal. In-flight requests after unmount; potential race conditions
   on fast navigation. The dead `useSwrFetch` already implements the
   correct pattern. (§3c)

*(The prior audit's #1 bug — missing `initial` props — is RESOLVED and
removed from this list. §1b.)*

### High: accidental drift with a clear canonical answer

2. ~~**Card primitive: 0 adoption**~~ — **RESOLVED 2026-06-30**, 13 import
   sites. (§2b)
3. ~~**Dialog primitive: 1 adoption**~~ — **RESOLVED 2026-06-30**, 9 import
   sites (the deliberately-excluded command-palette case, `global-search.tsx`,
   is still raw — correctly, per this doc's own original judgment that it's
   not a Dialog case). (§2c)
4. **Error handling: feedback now inconsistent *within* files** — ARL fixes
   added error state on mutation paths but left list-fetch catches
   console-only; 62 empty catches and 25 ARL console-only catches remain.
   (§3b) — not re-verified 2026-06-30.
5. ~~**Avatar primitive: 0 adoption**~~ — **RESOLVED 2026-06-30**, 6 import
   sites. (§2e)
6. ~~**Badge primitive: 2 adoptions**~~ — **RESOLVED 2026-06-30**, 13 import
   sites. (§2d)
7. **New ARL primitives are ARL-only** — `StatusDot`, `EmptyState`,
   `ModalCloseButton`, `DestructiveIconButton` are well-adopted inside
   `src/components/arl/` but the same patterns are still hand-rolled across
   dashboard, meeting-room, and shared components. Promote them to
   app-wide primitives. (§2a)

### Medium: fix on the way through any related edit

8. **`src/lib/motion.ts` created but imported nowhere** — adopt the `MOTION`
   constants codebase-wide or delete the file. Current state (correct
   constants, zero usage) mirrors the dead `useSwrFetch`. (§1c)
9. **Skeleton: ~11 hand-rolled `animate-pulse` placeholders** in
   `arl/layout.tsx`, `overview-dashboard.tsx`, `analytics-dashboard.tsx`,
   plus 5 inline shimmers in `locations-manager.tsx` (now visually
   identical to `<Skeleton>`). (§1d)
10. **Textarea, icon-only Button** — 3 raw textareas and remaining
    close/back buttons mapping to existing variants. (§2f)
11. **`async/await` vs `.then()` mixing in 3 files** — `dashboard/page.tsx`,
    `arl-dashboard-context.tsx`, `notification-tester.tsx`. (§3d)
12. **Legacy `{ error: "…" }` shape in 2 message-group routes + logout
    catch** — unchanged; adopt `ApiErrors.*`. (§6b)

### Low: incremental cleanup

13. **Lazy `any` typing** — `socket-server.ts` (21 `as any`, one
    augmentation fixes all); new `catch (err: any)` ×5 in
    `data-management.tsx` should be `unknown`; SQL param arrays, icon maps,
    socket emit params. (§5e)
14. **`useSwrFetch` hook still dead** — adopt its cleanup pattern
    codebase-wide or delete. (§3a)
15. **`isLoading` vs `loading`** — one-file naming drift in
    `group-info-modal.tsx`. (§3e)
16. ~~**2 unprotected migration endpoints**~~ — **RESOLVED**, both routes
    deleted (not just protected). (§6a)

---

## What changed from the prior version of this audit

The missing-`initial` motion bug is fully fixed (dropped from bug-level to
resolved); four new well-built primitives exist but are ARL-scoped; the
`Card`/`Avatar`/`Dialog`/`Badge` gaps persist codebase-wide; error handling
improved in ARL but is now inconsistent *within* files; and two
recommendations from the last audit (`motion.ts`, `useSwrFetch`) were partly
acted on — `motion.ts` was created but, like `useSwrFetch`, is dead code.
