# Code Style Audit — 2026-06-28

No code changes were made as part of this audit — findings only. This document
is the implementation-pattern counterpart to [DESIGN.md](DESIGN.md) and the
existing audit series ([ARL-AUDIT.md](ARL-AUDIT.md),
[DASHBOARD-AUDIT.md](DASHBOARD-AUDIT.md)): where those documents cover visual
and UX consistency, this one covers *code-level* consistency — the same problem
solved differently in different files because different sessions each picked
their own convention, not because anyone decided to vary it.

**What this audit does not cover:** anything already in DESIGN.md. Section 9
(Motion) and Section 15 (Component Consistency) address the *visual* motion and
component decisions; this audit covers the *implementation* of those decisions —
whether Framer Motion props are consistently written, whether shared UI
primitives are consistently *used*, whether async error handling is consistent,
etc. Read DESIGN.md first; this doc assumes familiarity with it.

Research was distributed across five parallel passes (animation patterns, UI
primitive adoption, data-fetching patterns, TypeScript conventions, API route
conventions), then synthesized. Every finding has file:line evidence and a
count. "Accidental drift" means the same problem solved independently multiple
times because nobody checked how it was already solved elsewhere; "deliberate"
means the variation serves a purpose.

## Scope

- `src/components/` — 82 component files across ARL console, kiosk dashboard,
  shared and meeting-room components
- `src/app/` — Next.js page components and 87 API route files
- `src/hooks/` — 6 custom hooks
- `src/lib/` — context providers, utilities, socket handlers

---

## Summary

| Dimension | Verdict | Drift severity |
|---|---|---|
| 1. Animation implementation | Mixed — mechanisms correct, details inconsistent | **High** |
| 2. Shared UI primitive adoption | Severe drift — Card/Dialog/Badge/Avatar barely used | **Critical** |
| 3. Data fetching & async state | Severe drift — error handling and cleanup universally inconsistent | **High** |
| 4. Socket event handling | Clean — consistent and correct everywhere | None |
| 5. TypeScript conventions | Mostly clean — `any` is the only real drift | Low |
| 6. API route conventions | Mostly clean — 2 files have legacy error shapes | Low |
| 7. File organization & naming | Clean — 100% consistent on every checked dimension | None |

---

## 1. Animation Implementation

### 1a. Mechanism inventory

| Mechanism | File count | Role in this codebase |
|---|---|---|
| Framer Motion (`motion.*`, `useAnimate`) | 54 | Entrance/exit and state transitions |
| `AnimatePresence` | 39 | Mount/unmount animation orchestration |
| CSS `transition-*` Tailwind classes | 84 | Press-state color/opacity changes |
| Tailwind `animate-*` utilities | 42 | Looping states: pulse, spin, ping |
| CSS `@keyframes` | 1 | `src/app/globals.css:205` — keyboard slide-up |
| `requestAnimationFrame` | 5 | Continuous media loops (audio meter, video) |

**Verdict: Deliberate.** The split is coherent — each mechanism is used for
the kind of animation it is best suited to. Framer Motion for sequenced
enter/exit and spring physics; Tailwind `animate-*` for repetitive looping
states; CSS transitions for simple press-state changes; `requestAnimationFrame`
for media loops where frame-perfect timing matters. The one `@keyframes` in
`globals.css` predates the Framer Motion investment and hasn't been migrated —
minor, not drift in any meaningful sense. These mechanisms do not overlap for
the same job.

### 1b. Framer Motion: missing `initial` props — real bug

**20+ `<motion.*>` elements have `animate` but no explicit `initial`.**

When `initial` is absent, Framer Motion renders the element at the `animate`
target value on the first paint — the entrance transition never runs. The
element appears fully rendered instantly, then is static. In React 18's
concurrent mode or after a navigation back, the missing `initial` can also
produce a visible flash. The codebase already had one confirmed instance of
this bug this session; the audit found 20+ more.

| File | Line(s) | animate target (no initial to match) |
|---|---|---|
| `src/components/arl/overview-dashboard.tsx` | 180, 200 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/tenant-settings.tsx` | 206 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/user-management.tsx` | 337 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/forms-repository.tsx` | 267 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/emergency-broadcast.tsx` | 167 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/messaging.tsx` | 494 | `{ opacity: 1, y: 0 }` |
| `src/components/arl/arl-sidebar.tsx` | 93 | `motion.aside` with `animate` only |
| `src/lib/socket-context.tsx` | 257, 274 | `{ opacity: 1 }`, `{ scale: [1, 1.08, 1] }` |
| `src/components/dashboard/restaurant-chat.tsx` | 1014, 1103 | `{ opacity: 1, y: 0 }` |
| `src/app/admin/page.tsx` | 227 | `{ opacity: 1, y: 0 }` |
| `src/app/meeting/page.tsx` | 540 | `{ opacity: 1, y: 0 }` |

**Verdict: Accidental drift.** The pattern `animate={{ opacity: 1, y: 0 }}`
without `initial={{ opacity: 0, y: 5 }}` was copied forward without its other
half. It is the most common entry-transition idiom in this codebase.

**Canonical pattern going forward:**
```tsx
<motion.div
  initial={{ opacity: 0, y: 5 }}
  animate={{ opacity: 1, y: 0 }}
  exit={{ opacity: 0, y: -5 }}
  transition={{ duration: 0.2, ease: "easeOut" }}
>
```
Every `<motion.*>` with an `animate` prop must have a matching `initial` that
defines the "from" state. If the element should not animate in on first mount,
use `initial={false}` on the surrounding `<AnimatePresence>`, not the absence
of `initial` on the element itself.

### 1c. Framer Motion: duration and easing — no shared constants

**17 distinct `duration` values and 4 `ease` values, all hand-typed inline
across 54 files.** No constants file exists.

Duration values (occurrences): `0.15` ×8, `0.18` ×1, `0.2` ×3, `0.25` ×2,
`0.28` ×1, `0.3` ×1, `0.4` ×1, `0.45` ×1, `0.5` ×3, `0.6` ×2, `0.8` ×1,
`0.9` ×1, `1.0` ×1, `1.2` ×6, `1.5` ×2, `1.6` ×1, `3.0` ×1.

Easing values (occurrences): `"easeOut"` ×10, `"easeInOut"` ×10, `"linear"`
×2, `[0.32, 0.72, 0, 1]` ×1 (custom bezier at
`src/components/dashboard/restaurant-chat.tsx:512`).

Not all 17 duration values represent drift — emergency pulse at `1.5s` and
fast UI exits at `0.15s` are intentionally different. But the micro-interaction
range (`0.15`–`0.5`) has no agreed tiers: files on the same surface use `0.2`,
`0.25`, and `0.3` interchangeably for what appear to be the same transition
type. DESIGN.md Section 9 already calls for "a single standard duration/easing"
(~150–200ms, ease-out) for ordinary feedback — that decision exists in text but
not in code.

**Verdict: Accidental drift for micro-interaction values.** Deliberate for
purpose-specific long durations (shimmer at 1.2s, emergency at 1.5s, etc.).

**Canonical recommendation:** Create `src/lib/motion.ts`:
```ts
export const MOTION = {
  fast:   { duration: 0.15, ease: "easeOut" },   // exits, quick feedback
  normal: { duration: 0.2,  ease: "easeOut" },   // standard enter/state
  slow:   { duration: 0.5,  ease: "easeInOut" }, // deliberate reveals
  loop: {
    shimmer: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    pulse:   { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
} as const;
```
Purpose-specific values (custom bezier in restaurant-chat, emergency 1s pulse)
stay inline with a comment explaining the divergence.

### 1d. Skeleton/loading: two systems in simultaneous use

The shared `<Skeleton>` primitive at `src/components/ui/skeleton.tsx` exports:
`Skeleton` (base), `TaskSkeleton`, `MessageSkeleton`, `CardSkeleton`,
`ConversationListSkeleton`, `TaskListSkeleton`. It is used in 7 files. At least
6 more files build their own loading states independently:

**Custom `motion.div` gradient shimmer** (different visual from Skeleton's pulse):
- `src/components/arl/locations-manager.tsx:141–152` — 5 instances, each a
  `<div>` containing a `motion.div` with
  `bg-gradient-to-r from-muted via-card to-muted` + `animate={{ x: ["-100%", "100%"] }}`

**Hand-rolled `animate-pulse` divs** (direct substitute for `<Skeleton>`):
- `src/components/arl/overview-dashboard.tsx:126,130–131` — 3 instances
- `src/app/arl/layout.tsx:296,299–305` — 7 instances
- `src/components/arl/analytics-dashboard.tsx:307,309`
- `src/components/arl/meeting-analytics.tsx:148,368`
- `src/components/arl/data-management-health.tsx:41`
- `src/components/dashboard/grid/grid-upcoming.tsx:141`

**Verdict: Accidental drift.** Files written before `skeleton.tsx` existed (or
without awareness of it) hand-rolled their own. The `animate-pulse` instances
are direct substitutes; the `motion.div` gradient shimmer in `locations-manager`
is a different visual that the current `Skeleton` doesn't support — that one
warrants adding a `"shimmer"` variant to `skeleton.tsx` rather than keeping it
as five inline copies.

**Canonical pattern:** `<Skeleton>` (with the appropriate exported variant)
for all loading placeholders. New loading visuals → add a variant to
`skeleton.tsx`, not inline motion code.

### 1e. AnimatePresence usage — consistent

39 files use `AnimatePresence`. Usage is appropriately distributed across
modals/dialogs (~15 files), dropdowns/menus (~8), alerts/toasts (~6), list
items (~5), page-step transitions (~3), and conditional panels (~2). Every
conditionally-mounted UI element that should animate on enter/exit is wrapped
in `AnimatePresence`. No meaningful cases of missing `AnimatePresence` were
found.

**Verdict: Deliberate and consistent.** No action needed.

---

## 2. Shared UI Primitive Adoption

`src/components/ui/` contains 15 primitives: `avatar.tsx`, `badge.tsx`,
`button.tsx`, `card.tsx`, `dialog.tsx`, `emoji.tsx`, `icon-tip.tsx`,
`input.tsx`, `label.tsx`, `scroll-area.tsx`, `shake.tsx`, `skeleton.tsx`,
`success-checkmark.tsx`, `tabs.tsx`, `textarea.tsx`.

| Primitive | Import sites | Hand-rolled equivalents | Adoption |
|---|---|---|---|
| `Button` | 20 | ~100 raw `<button>` | Low |
| `Badge` | 2 | ~43 inline chips/pills | Very low |
| `Card` | **0** | ~45 card-like divs | **None** |
| `Input` | 16 | ~3 raw inputs | Good |
| `Dialog` | **1** | ~34 custom overlays | **Near zero** |
| `Tabs` | 1 | 0 | Good |
| `Skeleton` | 7 | ~15 hand-rolled (§1d) | Partial |
| `Textarea` | 1 | 3 raw textareas | Very low |
| `Avatar` | **0** | Many `rounded-full` img/div | **None** |

### 2a. Card — zero adoption despite 45+ hand-rolled instances

**0 files import the `Card` primitive** (`Card`, `CardHeader`, `CardTitle`,
`CardContent`, `CardFooter`, `CardAction`). Approximately 45 card containers
exist built from raw divs matching the class string
`rounded-2xl border border-border bg-card` (or minor variations):

`src/components/arl/ticker-push.tsx:148` · `src/components/arl/overview-dashboard.tsx:126,130,273` · `src/components/arl/locations-manager.tsx:145,247` · `src/components/arl/data-management.tsx:384,478` · `src/components/arl/messaging.tsx:74,145,198,249` · `src/components/arl/remote-login.tsx:369` · `src/components/arl/user-management.tsx:343` · `src/components/arl/forms-repository.tsx:272` · `src/components/arl/remote-viewer.tsx:279` · `src/components/arl/task-virtual-list.tsx:56` · `src/components/arl/tenant-settings.tsx:209,251,357,391` · `src/components/arl/emergency-broadcast.tsx:163,263,272,381` · `src/components/arl/task-manager.tsx:202` · `src/components/arl/arl-calendar.tsx:163,214` · `src/components/arl/meeting-analytics.tsx:188,250,254,398` · `src/components/landing-page.tsx:35,72,124` · `src/components/global-search.tsx:142` · `src/components/arl/scheduled-meetings.tsx:284,418`

**Verdict: Accidental drift.** The primitive was written but never used. Every
writer independently reached for raw divs with the same class string. The
practical consequence: restyling the card surface currently requires 45
grep-and-replace operations instead of one file change.

**Canonical pattern:** `<Card>`, `<CardHeader>`, `<CardContent>` etc. from
`@/components/ui/card`.

### 2b. Dialog — near-zero adoption (accessibility concern)

**1 file imports `Dialog`** (`src/components/arl/group-info-modal.tsx`). At
least 34 overlays use `fixed inset-0 z-50` directly, bypassing the Dialog
primitive's focus management, `aria-modal`, portal, and keyboard-dismiss
plumbing.

Files with genuine modal dialogs that should use `Dialog`:
`src/components/arl/task-form-modal.tsx:141` · `src/components/arl/data-management.tsx:477` · `src/components/arl/meeting-analytics.tsx:334` · `src/components/arl/broadcast-launcher.tsx:126` · `src/components/arl/broadcast-studio.tsx:104` · `src/components/arl/user-management.tsx:418,569` · `src/components/arl/forms-repository.tsx:325` · `src/components/meeting-room/transfer-dialog.tsx:23` · `src/components/meeting-room/rename-dialog.tsx:28` · `src/components/confirm-dialog.tsx:70`

Files whose custom overlay is deliberately not a `Dialog` (intentional):
- `src/components/notification-panel.tsx:257` — slide-in panel, not a modal
- `src/components/arl/notification-settings-panel.tsx:472` — slide-in panel
- `src/components/dashboard/emergency-overlay.tsx:196` — fullscreen takeover
- `src/components/arl/remote-viewer.tsx:369` — fullscreen media viewer
- `src/components/global-search.tsx:157` — command-palette overlay with its own behavior

**Verdict: Accidental drift for the ~10 true modal cases.** The panel/overlay
cases are deliberately not `Dialog`. The distinction: if it has a title bar,
body content, and action buttons and should dismiss on Escape — it's a Dialog.

### 2c. Badge — near-zero adoption despite 43 hand-rolled instances

**2 files import `Badge`** (`task-virtual-list.tsx`, `group-info-modal.tsx`).
~43 inline status chips and count badges use `rounded-full text-xs` or similar:

`src/components/arl/arl-sidebar.tsx:180,188` (unread counts) · `src/components/app-header.tsx:177` · `src/components/arl/remote-login.tsx:277,326,463,637,641,645,649` · `src/components/arl/remote-viewer.tsx:289,397` · `src/components/arl/emergency-broadcast.tsx:225,389` · `src/components/arl/analytics-dashboard.tsx:412` · `src/components/notification-bell.tsx:446` · `src/components/meeting-room/transfer-dialog.tsx:45` · `src/components/meeting-room/participant-panel.tsx:93` · `src/components/meeting-room-livekit-custom.tsx:1119,1156,1358` · `src/components/landing-page.tsx:51` · `src/components/dashboard/grid/grid-messages.tsx:100,132` · `src/components/dashboard/grid/grid-mobile-stack.tsx:61` · `src/components/arl/swipeable-convo-row.tsx:146`

**Verdict: Accidental drift.** Same root cause as Card.

### 2d. Avatar — zero adoption

**0 files import the `Avatar` primitive** (`Avatar`, `AvatarImage`,
`AvatarFallback`, `AvatarGroup`, `AvatarBadge`, `AvatarGroupCount`). Multiple
avatar-style elements across meeting room, messaging, and ARL use raw
`rounded-full` divs with initials or `<img>` elements directly.

**Verdict: Accidental drift.**

### 2e. Button, Textarea — partial adoption with clear substitution cases

**Button** (20 import sites): Adopted where variants were needed. The ~100
remaining raw `<button>` elements divide into:
- *Could use Button*: icon-only close/back buttons that map to
  `variant="ghost" size="icon"` — `src/components/arl/messaging.tsx:76,147,251`,
  `src/components/arl/task-form-modal.tsx:159`,
  `src/components/arl/data-management.tsx:394,401`,
  `src/components/arl/broadcast-launcher.tsx:142`,
  `src/components/arl/broadcast-studio.tsx:119`
- *Legitimate raw buttons*: toggle/segmented controls in `task-form-modal.tsx`
  (time/all-day, recurring type, day selector, assign mode — lines 253–497),
  calendar navigation chevrons — these need styling not currently a Button
  variant

**Textarea** (1 import site): 3 raw textareas that are direct substitutes —
`src/components/arl/ticker-push.tsx:173`,
`src/components/arl/emergency-broadcast.tsx:339`,
`src/components/arl/task-form-modal.tsx:183`.

**Verdict for substitution cases: Accidental drift.**

### 2f. Input — good adoption; Tabs — good adoption

**Input** (16 import sites, ~3 raw inputs): The 3 raw inputs are specialized
search inputs within specific UI patterns that may legitimately need custom
styling (`messaging.tsx:152`, `data-management-audit-log.tsx:51`). Not a
significant drift.

**Tabs** (1 import site — `src/app/arl/meetings/page.tsx`): Used correctly;
no hand-rolled tab implementations found.

---

## 3. Data Fetching & Async State

### 3a. Fetch mechanism — single pattern, one dead hook

All 43 data-fetching component files use the manual `useState` + `useEffect` +
`fetch` pattern. No files use `axios`. The `useSwrFetch` hook at
`src/hooks/use-swr-fetch.ts` is **never imported anywhere in the codebase** —
it is dead code. Notably, it implements proper `AbortController`-equivalent
cleanup via a `mountedRef` pattern (lines 53, 73, 77) that the manual pattern
everywhere else omits (§3c).

**Verdict:** The manual pattern is the de-facto standard. `useSwrFetch` should
be adopted (taking its cleanup pattern with it) or deleted.

### 3b. Error handling — three competing philosophies, 88% silent

56 catch blocks analyzed across component files:

| Category | Count | Files (sample) |
|---|---|---|
| **Empty** (`.catch(() => {})` or `catch {}`) | 12 | `app/login/page.tsx:424`; `app/dashboard/page.tsx:102,320`; `lib/arl-dashboard-context.tsx:314,546,548`; `components/voice-recorder.tsx:187`; `components/dashboard/restaurant-chat.tsx:361`; `lib/layout-context.tsx:37,47` |
| **`console.error` only** (no user feedback) | 29 | `arl/overview-dashboard.tsx:76`; `arl/locations-manager.tsx:65`; `arl/meeting-analytics.tsx:104,119,138`; `arl/forms-repository.tsx:96,123`; `arl/task-manager.tsx:54,138,151`; `arl/analytics-dashboard.tsx:111`; `notification-panel.tsx:188,215,235`; `group-info-modal.tsx:120,156,181,208,236,263`; `app/admin/page.tsx:81,177,200` |
| **Sets error state** (user sees failure) | ~7 | `arl/data-management.tsx:72,160,226,242`; `arl/tenant-settings.tsx:91`; `meeting-room-livekit-custom.tsx:99`; `lib/tenant-context.tsx:151` |
| Intentional suppression (audio, push) | ~8 | Fire-and-forget operations where failure has no user impact |

Only ~12% of catch blocks surface failures to the user. 88% either swallow the
error silently or log it only to the console, leaving users with a broken UI
and no explanation.

**Verdict: Accidental drift.** There is no consistent philosophy — behavior
varies by file and sometimes within the same file (`data-management.tsx`
correctly sets error state; `task-manager.tsx` in the same directory only logs).

**Canonical pattern:** Set error state for all fetch failures in
user-visible components. The model is `data-management.tsx`:
```ts
} catch (err: unknown) {
  setError(err instanceof Error ? err.message : "Something went wrong");
}
```
Silent suppression is acceptable only when the operation is fire-and-forget
with no user-visible consequence (e.g., `audio.play()` failing due to browser
autoplay policy).

### 3c. AbortController / unmount cleanup — universally missing

**0 of 43 data-fetching files use `AbortController`** for request cancellation
on component unmount. Every `useEffect` that calls `fetch` has no cleanup
function. This is a codebase-wide gap, not a per-file omission.

When a component unmounts while a fetch is in flight, the response handler
still runs and calls `setState` — in React 18 concurrent mode this silently
drops the update, but it represents wasted network round-trips and can cause
race conditions when fast navigation re-mounts the same component with an older
request's response arriving after a newer one.

The existing (unused) `useSwrFetch` hook already implements this correctly.
The missing pattern for direct `fetch` usage:
```ts
useEffect(() => {
  const controller = new AbortController();
  fetch("/api/...", { signal: controller.signal })
    .then(r => r.json())
    .then(data => setData(data))
    .catch(err => {
      if (err.name !== "AbortError") setError("Failed to load.");
    });
  return () => controller.abort();
}, [deps]);
```

**Verdict: Accidental drift — universal.** No file established this pattern;
it was never adopted.

### 3d. Async style — `.then()` and `async/await` mixed in 3 files

Most files use `async/await` consistently. ~21 files use `.then()` chains.
Three files mix both styles within the same component:

- `src/app/dashboard/page.tsx` — `.then()` at lines 92–102, 318–320; `async/await` everywhere else
- `src/lib/arl-dashboard-context.tsx` — `.then()` at lines 300–314, 528–548; `async/await` everywhere else
- `src/components/arl/notification-tester.tsx` — `.then()` at line 34; `async/await` at line 155

**Verdict: Accidental drift** for the within-file mixing. `async/await` is
overwhelmingly dominant and is the canonical style. The `.then()` chains in
otherwise-async-await files are holdovers that weren't updated.

### 3e. Loading state naming — acceptable split

| Name | Count | Context |
|---|---|---|
| `loading` | 18 | Generic data-fetch loading |
| `sending` | 2 | Form submission in flight |
| `uploading` | 1 | File upload |
| `saving` | 1 | Settings save |
| `activating` | 1 | Session activation |
| `clearing` | 1 | Emergency message clear |
| `pinSaving` | 1 | PIN-specific save |
| `isLoading` | 1 | `group-info-modal.tsx` (minor drift) |

**Verdict:** The semantic-action names (`sending`, `uploading`, `saving`) are
deliberate — they communicate intent better than a generic `loading` boolean
when multiple async operations can be in flight simultaneously. The one `isLoading`
vs. `loading` inconsistency is trivial. No action needed beyond standardizing
on `loading` for generic single-fetch-per-component cases.

---

## 4. Socket Event Handling

### 4a. Cleanup — correct and consistent everywhere

**100% of component-level `socket.on()` calls have a matching `socket.off()`
in the `useEffect` cleanup.** 24 files, 117 total event subscriptions audited.
Every file follows the same shape:

```ts
useEffect(() => {
  if (!socket) return;
  const handler = (data: EventType) => { /* ... */ };
  socket.on("event:name", handler);
  return () => { socket.off("event:name", handler); };
}, [socket]);
```

Context-level listeners in `SocketProvider` (`src/lib/socket-context.tsx:76–215`)
are cleaned up via `s.disconnect()` on provider unmount — correct.

Files with the most event subscriptions, all correctly cleaned up:
`src/components/meeting-room-livekit-custom.tsx` (23 events) ·
`src/components/arl/remote-viewer.tsx` (11) ·
`src/lib/mirror-context.tsx` (11) ·
`src/app/dashboard/page.tsx` (11) ·
`src/lib/arl-dashboard-context.tsx` (8)

**Verdict: Deliberate and clean.** This is the strongest consistency finding
in the codebase. No action needed.

---

## 5. TypeScript Conventions

### 5a. `interface` vs `type` — consistent and correct

- **108 `interface` declarations**, **12 `type` declarations** across `src/`.
- `interface` is used for all component props (40 declarations) and all data/API
  payload shapes (8 declarations). No `type` is used for either category.
- `type` is used correctly for its appropriate purpose: union/literal types
  (`type LoginStep = "userId" | "pin"` — `src/app/login/page.tsx:13`),
  mapped/inferred types (`type NotificationPreferences = typeof ... .$inferSelect`
  — `src/app/api/preferences/notifications/route.ts:8`), and structural types
  where extension is not needed.
- **0 `enum` declarations** — exclusively `as const` and union strings (51
  `as const` patterns found). This is the modern TypeScript idiom.

**Verdict: No drift.** These dimensions are uniformly consistent.

### 5b. FC / React.FC — zero usage

**0 files use `React.FC<Props>` or `FC<Props>`.** All components are plain
function declarations with inferred return types. This follows current React
best practices (React 18 dropped the implicit `children` prop from `FC`).

**Verdict: No drift.**

### 5c. Export conventions — correct for context

- `export default function` — 26 occurrences, exclusively Next.js page
  components in `src/app/` (required by the App Router)
- `export function` / `export const` — everywhere else (components, hooks, lib)
- UI primitives use named export blocks (`export { Button, buttonVariants }`)

**Verdict: No drift.**

### 5d. Prop type definition style — acceptable split

- **Inline anonymous** (~32 occurrences): simple/private helper components and
  context providers (`LiveActivityFeed`, `MiniSparkline`, `SocketProvider`)
- **Named interface above function** (~30 occurrences): exported, reusable
  panel-level components (`NotificationSettingsPanel`, `VoiceRecorder`,
  `ZoomableVideo`)

The split tracks complexity rather than randomness. This is an implicit rule
that is consistently applied; worth making it explicit: use a named `interface`
when the component is exported or has ≥4 props; inline when it is a private
sub-component with ≤3 props.

**Verdict: No drift, but worth documenting the implicit rule.**

### 5e. `any` usage — 163 occurrences, partially legitimate

| Pattern | Occurrences | Files |
|---|---|---|
| `: any` annotations | 78 | 37 files |
| `as any` assertions | 82 | 23 files |
| `<any>` generics | 3 | 3 files |

**Highest-count files:**
- `src/lib/socket-server.ts` — 28 total (7 `: any` + 21 `as any`): extending
  Socket.io socket objects with custom properties. The 21 `as any` assertions
  are all working around the same underlying issue — Socket.io's TypeScript
  types don't allow arbitrary property attachment. One augmented interface
  declaration would eliminate all 21.
- `src/lib/remote-capture.ts` — 11 `as any`: accessing non-standard private
  `RTCPeerConnection` properties. Legitimate escape hatch; could be narrowed
  with a local `interface` cast instead.
- `src/app/api/data-management/integrity-check/route.ts` — 7 `as any`:
  Drizzle ORM `better-sqlite3` driver returns untyped results. Legitimate.
- `src/lib/socket-handlers/tests.ts` — 8 `: any`: test handler data. Acceptable.
- `src/app/api/analytics/tasks/route.ts:30,60,83,110,136` and
  `analytics/messaging/route.ts` — `params: any[]` where
  `params: (string | number)[]` is correct. **Lazy typing.**
- `src/components/global-search.tsx:16` — `Record<string, any>` for icon map
  where `Record<string, React.ComponentType<{ className?: string }>>` is
  correct. **Lazy typing.**
- `src/lib/socket-emit.ts:73,229,248` — `data: any` on typed emit functions
  where a discriminated union per event could provide types. **Lazy typing.**

**Verdict: Mixed.** Most `any` in `socket-server.ts`, `remote-capture.ts`,
SQLite query results, and test helpers is a legitimate escape hatch for
genuinely untyped third-party boundaries. The SQL parameter arrays, icon type
maps, and socket emit parameters are lazy typing that could be fixed without
friction.

**Recommendation:** The 21 `as any` in `socket-server.ts` should be replaced
with a single socket type augmentation declaration — that one file accounts for
13% of all `as any` usage. Other lazy-typing instances: fix incrementally when
editing those files.

---

## 6. API Route Conventions

### 6a. Auth session check — consistent

87 route files total. Auth check pattern: `const session = await getAuthSession(); if (!session) return unauthorized();` at the top of every handler — consistent in all 77 protected routes.

Routes that deliberately skip `getAuthSession()` and why:
- **Public endpoints** (8): `auth/login`, `auth/resolve-org`, `auth/resolve-org-by-ip`, `auth/validate-user`, `tenants/signup`, `meetings/join`, `session/pending`, `session/pending/status` — all correctly identified public surfaces.
- **Session-management routes** (6): `session/ping`, `session/code`, `session/force`, `session/activate`, `session/heartbeat`, `session/pending` — use `getSession()` from `@/lib/auth` directly because they don't need the tenant context that `getAuthSession()` wraps. Deliberate.
- **Health check** (1): `health/route.ts` — public monitoring endpoint. Deliberate.
- **Migration endpoints** (2): `migrate-users/route.ts`, `admin/migrate-4digit/route.ts` — no auth check. Flagged; these are temporary operational routes that should either be protected or removed once their purpose is fulfilled.

**Verdict: Deliberate throughout**, except the 2 unprotected migration endpoints.

### 6b. Response helper adoption — mostly clean

`apiSuccess` / `ApiErrors` from `src/lib/api-response.ts` are used in ~91
route files. Three files have accidental drift with legacy response shapes:

- `src/app/api/messages/groups/[id]/members/route.ts:22–211` — 10+ hand-rolled
  `{ error: "..." }` and `{ success: true, addedCount }` responses throughout
  the file
- `src/app/api/messages/groups/[id]/leave/route.ts:26–88` — 6 hand-rolled
  `{ error: "..." }` / `{ success: true, deleted: true/false }` responses
- `src/app/api/auth/logout/route.ts:43–45` — one `{ error: "..." }` in the
  catch block

These files predate the `ApiErrors` helpers and were never updated.

Deliberate non-adopters (not drift): cookie-setting auth routes must use
`NextResponse.json()` directly to call `.cookies.set()` (helpers don't expose
the response object); `emergency/route.ts` has a domain-specific
`{ message, history }` structure; `health/route.ts` uses standard health-check
fields; migration endpoints are temporary.

**Verdict: Accidental drift in the two messages/groups routes and one error
path in logout.** Canonical: `return ApiErrors.badRequest("reason")`,
`return ApiErrors.notFound("entity")`, `return apiSuccess({ ... })`.

### 6c. HTTP method exports and error handling — consistent

All routes use `export async function GET/POST/PUT/PATCH/DELETE()`. All
protected routes have a top-level `try { ... } catch (error) { console.error("...", error); return ApiErrors.internal(); }`. Status codes are consistently driven through the `ApiErrors` helpers (400/401/403/404/429/500). No older patterns found.

**Verdict: No drift.**

---

## 7. File Organization & Naming

All checked dimensions are consistent across the full `src/` directory:

| Dimension | Pattern | Outliers |
|---|---|---|
| Component filenames | `kebab-case.tsx` throughout | None |
| `"use client"` placement | Line 1, before all imports, always | None |
| Type/interface co-location | Inline in component file; shared `types.ts` for cross-file domain types | None |
| API route naming | `route.ts` with bracket notation for dynamic segments | None |
| API route organization | Domain-grouped under `src/app/api/` | None |
| Export convention | `export default` for pages; named exports for components | None |

No `src/types/` directory exists — types are intentionally co-located with
their consumers. Two domain-specific type files exist and are appropriate:
`src/components/meeting-room/types.ts` and `src/lib/socket-handlers/types.ts`.

**Verdict: No drift on any dimension.** File organization is the cleanest
area in this audit.

---

## Findings by priority

### Bug-level: fix before next release

1. **Missing `initial` props on `<motion.*>` elements** — 20+ instances. The
   entrance animation never fires; on SSR/re-mount it can produce a visible
   flash. (§1b)

2. **No `AbortController` cleanup on any `useEffect` fetch** — 43 files,
   universal. In-flight requests after unmount; potential race conditions on
   fast navigation. (§3c)

### High: accidental drift with a clear canonical answer

3. **Card primitive: 0 adoption** — 45+ hand-rolled substitutes with the same
   class string. Restyling the card surface requires 45 grep-and-replace
   operations. (§2a)

4. **Dialog primitive: 1 adoption** — ~10 true modal dialogs built with raw
   `fixed inset-0 z-50`, bypassing accessibility plumbing (focus management,
   `aria-modal`, keyboard dismiss). (§2b)

5. **Error handling: 88% of catch blocks give no user feedback** — the majority
   silently swallow errors or only log to console. (§3b)

6. **Badge primitive: 2 adoptions** — 43 hand-rolled substitutes. (§2c)

7. **Avatar primitive: 0 adoption** — many hand-rolled substitutes. (§2d)

8. **Skeleton: two systems in simultaneous use** — `animate-pulse` hand-rolled
   blocks in 6+ files alongside the shared `<Skeleton>`. (§1d)

### Medium: fix on the way through any related edit

9. **Textarea, icon-only Button** — 3 raw textareas and ~7 close/back buttons
   that map directly to existing primitive variants. (§2e)

10. **Motion duration/easing: no constants** — 17 unique duration values
    hand-typed inline; create `src/lib/motion.ts`. (§1c)

11. **`async/await` vs `.then()` mixing in 3 files** — normalize to
    `async/await` in `dashboard/page.tsx`, `arl-dashboard-context.tsx`,
    `notification-tester.tsx`. (§3d)

12. **Legacy `{ error: "..." }` response shape in 2 message-group API routes**
    — adopt `ApiErrors.*` on next edit to those files. (§6b)

### Low: incremental cleanup

13. **Lazy `any` typing** — SQL param arrays, icon maps, socket emit params.
    The `socket-server.ts` `as any` volume (21 instances) warrants a single
    socket type augmentation declaration. (§5e)

14. **`useSwrFetch` hook** — adopt its cleanup pattern codebase-wide or delete
    the dead hook. Either outcome is better than the current state (a correct
    pattern exists, unused). (§3a)

15. **`isLoading` vs `loading`** — minor naming drift in one file
    (`group-info-modal.tsx`). Standardize to `loading`. (§3e)
