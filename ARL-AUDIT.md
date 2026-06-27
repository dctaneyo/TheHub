# ARL Console Audit — 2026-06-27

Audit of the ARL admin console (`/arl/*`) against [DESIGN.md](DESIGN.md),
using `npm run design:scan` plus manual review. No code changes were made
as part of this audit — findings only, to plan the ARL design pass.

This is the ARL counterpart to [DASHBOARD-AUDIT.md](DASHBOARD-AUDIT.md)
(the kiosk `/dashboard` surface). The headline is the same shape as that
audit's was: the mechanical, codebase-wide retrofits (weight scale, font
floor, 8pt spacing) already reached ARL, but the **per-surface passes the
kiosk dashboard got — hover→active, IconTip, the indigo→teal migration —
never ran here.** ARL is roughly where `/dashboard` was before its
redesign pass.

## Scope

The whole ARL console: the shell (`src/app/arl/layout.tsx`,
`arl-sidebar.tsx`, `page-indicator.tsx`), the 15 routes under
`src/app/arl/`, and the 29 components in `src/components/arl/`. The route
files are thin wrappers (`<Component />` inside a scroll container); the
real surface is the components.

Shared components reachable from ARL but owned elsewhere
(`global-search`, `notification-bell`, `notification-panel`,
`confirm-dialog`, `meeting-room/*`, `stream-viewer`) are noted where ARL
leans on them but are out of scope for line-level findings — they serve
other routes too.

## Scanner summary (scoped to ARL)

```
src/app/arl          15 files   10 findings   vibe 20
src/components/arl   32 files  183 findings   vibe 427   (high 61, medium 122)
combined             47 files  193 findings   vibe 447
verdict: "STRONG AI-default look"
```

As with the earlier audits, the verdict overstates it — most volume is
the scanner firing on deliberate conventions (semantic amber/emerald, the
heavy-radius house style, mount transitions). The real signal is below.

| Rule | Hits | Assessment |
|---|---|---|
| `ai-purple` | 41 | **Mixed.** Real arbitrary indigo in the remote-view feature, meeting analytics, and data-management (see Finding 3). The rest is categorical: conversation-type in `messaging`, the 8-series chart palette in `analytics-dashboard`, avatar-hash colors in `group-info-modal`, and the tenant brand-color *picker* (offering Purple/Indigo as tenant choices isn't the app defaulting to them). |
| `claude-default-look` | 20 | **All false positives.** Fires on `bg-amber-*`/`bg-orange-*`, which here is legitimate semantic priority/status color. No serif, no cream background anywhere. |
| `rounded-everything` | 88 | **Partly real.** ARL leans on `rounded-2xl` for cards fairly consistently, but `rounded-xl`/`rounded-lg`/`rounded-full` mix in controls without the documented container/control/circle logic the login page got. Same "needs the radius pass" conclusion as the dashboard audit, lower severity than the interaction findings. |
| `fade-in-animations` | 41 | **Mostly mount transitions, not scroll/hover decoration.** Worth standardizing durations (Section 9), not deleting. |
| `emoji-as-icons` | 2 | **Minor.** `ticker-push.tsx:17` is a user-selectable message-icon picker (content the ARL pushes to dashboards, not UI chrome); `notification-settings-panel.tsx:43` is a `✅` in notification sample data. Neither is an emoji standing in for a real UI icon. |
| `purple-blue-gradient` | 0 | None. The only gradients are red→orange (Finding 6) and grey skeleton shimmers (not a tell). |
| `hero-three-cards` | 1 | **False positive** — `scheduled-meetings.tsx:303` is a 3-col meeting list grid, not a hero-then-cards skeleton. |

The scanner has **no rule** for the two highest-value findings (hover-only
feedback, `title`-only tooltips) — both are product-specific, not general
AI-slop patterns. They're found by manual review below.

## Genuine findings

### 1. Hover-only feedback — the largest finding, scanner-invisible

**~230 `hover:` instances across 30 of the 47 ARL files**, and ARL never
got the hover→active sweep that login and `/dashboard` already had. DESIGN.md
Section 6 is unambiguous: no pointer device, so hover-only feedback is
invisible to real users and risks the "stuck hover" bug on touch browsers.
Spot-checked across the heaviest files and confirmed these are genuinely
hover-*only* (no `active:` pairing), not false positives:

| File | `hover:` count |
|---|---|
| `messaging.tsx` | 19 |
| `user-management.tsx` | 16 |
| `data-management.tsx` | 16 |
| `remote-login.tsx` | 14 |
| `scheduled-meetings.tsx` | 11 |
| `forms-repository.tsx` | 8 |
| `task-form-modal.tsx` | 7 |
| `notification-settings-panel.tsx` | 7 |
| `emergency-broadcast.tsx` / `locations-manager.tsx` / `meeting-analytics.tsx` | 6 each |
| `analytics-dashboard.tsx` / `arl-sidebar`-cluster / `task-*` / `remote-viewer.tsx` / `layout.tsx` | 3–5 each |
| 13 more files | 1–3 each |

Representative confirmed cases: sidebar nav + Sign Out
(`arl-sidebar.tsx:146,176`), every row action in `user-management.tsx`
(380/386/392/400), every row action in `task-virtual-list.tsx`
(119/127/133), the shell controls (`layout.tsx:161,218,261,424`), and the
`data-management` action buttons whose `colorMap` defines `hover:bg-*-700`
+ `disabled:` but **no** `active:` (lines 315–325).

Two lower-priority sub-cases to *not* lump in with the mechanical swap:
- `hover:shadow-md` on whole cards (`locations-manager.tsx:191`,
  `task-virtual-list.tsx:56`, `forms-repository.tsx:258`) is decorative
  polish, not the only feedback — lower priority.
- A few controls already pair a press state via `active:scale-[0.98]`
  (e.g. `remote-viewer.tsx:279`) but still shift *color* on hover only —
  move the color shift to `active:` too.

This is the single highest-value, lowest-risk fix available — the same
mechanical pattern as the login/dashboard sweeps.

### 2. Zero IconTip adoption — icon-only controls still rely on `title=`

`IconTip` (the touch-compatible tooltip built for exactly this, Section
13) is used in **zero** ARL files. Meanwhile ~16 icon-only controls rely
on the native `title` attribute, which is hover-triggered and so
functionally invisible on a touch device:

- `messaging.tsx` 265 (Group Info), 277 (Search), 398 (See who read), 454 (Add reaction)
- `user-management.tsx` 381 (Manage permissions), 394 (Enable/Disable), 401 (Delete), 604 (role template)
- `scheduled-meetings.tsx` 480 (Copy code), 506 (Delete)
- `remote-login.tsx` 354 (Ping device), 513 (Force reassign)
- `locations-manager.tsx` 223 (Reset PIN), 239 (Sound toggle)
- `forms-repository.tsx` 294 (Email), `swipeable-convo-row.tsx` 154 (Delete), `tenant-settings.tsx` 304 (color swatch)
- `layout.tsx` 162 (Settings)

Worse than `title` are the icon-only controls with **no** label mechanism
at all: the mobile menu button (`layout.tsx:140`), the sidebar close
(`arl-sidebar.tsx:108`), and the calendar month-nav arrows
(`arl-calendar.tsx:165,167`). `ChartCard title=` props in
`analytics-dashboard.tsx` are a component prop, not the HTML attribute —
not a finding.

### 3. Indigo still drives the remote-view feature — the teal migration missed ARL

DESIGN.md Section 2's claimed-color table assigns **`--hub-teal`** to
"remote mirroring/viewing session active," and the Changelog
(`2026-06-26`) records replacing the old unstated indigo with that token.
That migration only touched the dashboard side (`remote-view-banner`,
`mirror-toolbar`). The ARL side is still entirely indigo:

- **`remote-viewer.tsx`** — header icon chip (253–254), card hover border
  (279), current-page text (300), the Eye affordance chip (305), the live
  dot (378), and the connecting spinner (455–456) are all `indigo-*`. This
  is the whole feature surface running on the exact color the spec already
  retired. Should be `--hub-teal`.
- **`remote-management.tsx:22–23`** — same indigo Monitor chip.

Separately, indigo is used as an **arbitrary accent with no semantic job**
(every claimed color is already spoken for):
- `meeting-analytics.tsx` — `color="indigo"` StatCards (184, 393) + map (465).
- `data-management.tsx` — `color:"indigo"` on "Clear All Offline" (275) and
  "Archive Old Tasks" (293); the `colorMap` (321) also carries
  `purple/blue/sky/cyan` variants, i.e. a rainbow of unconsidered accents
  for maintenance cards (Section 11: "color is never sprinkled in for
  visual interest").
- `analytics-dashboard.tsx` — the chart palette is legitimately categorical,
  but `#8b5cf6` (32, 403, 432) is specifically the banned Tailwind violet;
  swap that one series hue.

### 4. Selected-state drift — tint/border where it should be solid inverted fill

Section 10: selected = solid inverted fill, not a tint, border, ring, or
checkmark. ARL does this **right** in several places (`arl-sidebar.tsx:145`
nav, `page-indicator.tsx:31`, `task-manager.tsx:216` tabs,
`forms-repository.tsx:246` filter) — so the pattern is established and the
violations below are drift from it, not an unknown:

- `task-form-modal.tsx` — five separate button groups
  (203/225/308/416/447) use `border-[var(--hub-red)] bg-[var(--hub-red)]/10
  text-[var(--hub-red)]` (tint + border).
- `arl-calendar.tsx:185` — selected day uses `bg-[var(--hub-red)]/5 ring-1`
  (tint + ring).
- `ticker-push.tsx:155` — icon picker selected uses `/10 + ring-2`.
- `tenant-settings.tsx:307` — color picker selected uses `border-foreground
  scale-110` (border + scale).

### 5. Numeric/code displays using `--font-sans` + `tabular-nums` instead of `--font-mono`

Section 1 names this specifically as "the one safe font tell, disguised
with a CSS property." The mono pattern already exists in ARL
(`layout.tsx:201` renders the session code with `font-mono`), but isn't
applied consistently:

- `overview-dashboard.tsx:200` — KPI value `text-3xl font-black tabular-nums`
  (sans). Also off the type scale: Display is `text-2xl`, not `text-3xl`.
- `overview-dashboard.tsx:258` — trend value `text-xs ... tabular-nums` (sans).
- `remote-login.tsx:339` — session code `text-2xl font-black tracking-[0.2em]`
  (sans). `font-black` for a code is the allowed exception; the missing
  `font-mono` is the violation.

### 6. Decorative red→orange gradients vs the flat house style

Section 3 makes the house style flat fill-contrast; Behavior Rules require
stating what a gradient communicates. The broadcast/meetings surfaces use
`bg-gradient-to-r from-red-600 to-orange-600` decoratively:

- `broadcast-launcher.tsx:134,170` (the 170 one also has a hover-only
  `hover:from-red-700` shift and stacks `shadow-lg` + colored shadow),
  `broadcast-studio.tsx:111`, `meetings/page.tsx:20`.

At least it's consistent across the broadcast feature, but it's off the
flat-fill direction and compounds effects (gradient + shadow + colored
shadow) on one element — pick a flat semantic fill.

### 7. Off-scale icon sizing in the shell/sidebar

Section 14's icon scale is `h-3.5 / h-4 / h-5`. The shell nav uses a
one-off `h-4.5 w-4.5`: `layout.tsx:142,164` and `arl-sidebar.tsx:149,178`.
Round to `h-4` or `h-5`.

### 8. Component drift — the same element rebuilt several ways (Section 15)

Recurring patterns implemented slightly differently per file, each a
candidate for one shared component:
- **Destructive icon button** — `user-management.tsx:400`
  (`hover:bg-red-500/10 hover:text-red-600`) vs `task-virtual-list.tsx:133`
  (`hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-950`).
- **Status presentation** — full `Badge` backgrounds
  (`task-virtual-list.tsx:60–70`, `locations-manager.tsx:252–270`) where
  Section 10 wants dot + plain-weight label; and status-dot *sizes* drift
  (`h-1.5`, `h-2`, `h-2.5` all in use — `messaging.tsx`,
  `emergency-broadcast.tsx`, `locations-manager.tsx`). Extract one
  `StatusDot`/`StatusChip`.
- **Empty state** — bare centered text (`task-virtual-list.tsx:39`,
  `data-management-audit-log.tsx:67`) vs icon + action
  (`forms-repository.tsx:297`). Extract one `EmptyState`.
- **Modal header** — `user-management.tsx:423` vs `task-form-modal.tsx:155`
  differ in wrapper/close-button styling.

### 9. User-flow: silent failures (Section 16)

Section 16 already names "an action can fail with zero feedback" as an open
issue on the dashboard; ARL has the same pattern in several places —
empty `catch` blocks that swallow API errors with no user-visible result:
`user-management.tsx` (101, 177, 263, 283), `locations-manager.tsx:97`
(sound toggle), `forms-repository.tsx` (141, 159), `data-management.tsx:52`.
Also: `task-manager.tsx:133` deletes a template via `fetch` with **no
confirm dialog**, while `user-management` and `forms-repository` correctly
gate delete behind `useConfirmDialog` — inconsistent and risky for a
destructive action.

### 10. Shadow/elevation — resting card shadows + an inconsistent scale (Section 3)

Section 3 makes elevation "minimal-to-flat — prefer fill-color contrast
between surfaces over shadow," and reserves shadow for true overlays. The
dashboard's redesign already acted on this (Changelog: "removed resting
shadows from `.pill`/widget cards in favor of flat fill-contrast") — its
grid widgets carry no resting shadow, and shadow appears only on overlays
and the actively-dragged widget (`widget-container.tsx:181`). **ARL went
the opposite way and the two surfaces of the same product now disagree.**

- **Resting `shadow-sm` on nearly every card.** The near-universal ARL card
  is `bg-card border border-border … shadow-sm` at rest — overview
  (`overview-dashboard.tsx:195,222,248,279,284`), `messaging.tsx`
  (74,145,198,249), `data-management*` (342/389, health 32/49, audit-log
  35), `analytics-dashboard.tsx:47,70`, `arl-calendar.tsx:163,214`,
  `task-manager.tsx:202`, `task-virtual-list.tsx:56`, `locations-manager.tsx:191`,
  `forms-repository.tsx:272`, `emergency-broadcast.tsx:263,272,381`. They're
  consistent with each *other*, but this is exactly the "untouched
  shadcn default — `border bg-card … shadow-sm`" pattern Do Not Use names,
  and it contradicts the flat direction the dashboard adopted.
- **The elevation scale isn't standardized.** Modals split between `shadow-xl`
  (`task-form-modal.tsx:150`, `data-management.tsx:416`) and `shadow-2xl`
  (`broadcast-studio.tsx:108`, `broadcast-launcher.tsx:131`,
  `user-management.tsx:424`, `forms-repository.tsx:331`,
  `meeting-analytics.tsx:335`) for the same role.
- **Shadow used as a selection signifier** (conflicts with Section 10's
  solid-inverted-fill). In segmented controls the active tab gets `bg-card …
  shadow-sm` floating over flat inactive segments — `user-management.tsx:316`,
  `task-form-modal.tsx:258,268`, `remote-management.tsx:38,50`,
  `analytics-dashboard.tsx:286,296`, `remote-login.tsx:387,399`. This is the
  most visible "some elements have shadows, some don't" instance.
- **Decorative colored shadows** — `arl-sidebar.tsx:145` (`shadow-red-200` on
  the active nav item) and `layout.tsx:362` (`shadow-emerald-100` toast).

Fix as one elevation pass: drop resting card shadows in favor of the
border/fill contrast the cards already have, pick one modal depth, and
replace the active-tab shadow lift with a solid fill.

### 11. Minor: Data-drives-UI polish (Section 11)

- Numbers not right-aligned: `task-virtual-list.tsx:101` (points),
  `forms-repository.tsx:278` (file size).
- `data-management-audit-log.tsx` renders time-ordered audit data as a flat
  list; Section 11 prefers a timeline for "what happened when."
- `data-management.tsx:334` uses `text-xs sm:text-sm` on body copy —
  shrinking below the 14px body floor *specifically on mobile*, the exact
  failure mode Section 1's font-floor guards against.

## Non-findings worth noting

- **Icon barrel is clean** — zero direct `lucide-react`/`@phosphor-icons/react`
  imports anywhere in ARL; everything routes through `src/lib/icons.tsx`
  (Section 14 ✓).
- **Weight scale reached ARL** — no `font-medium`/`font-bold`; the six
  `font-black` uses are all within the stated exception (session codes,
  brand monograms, KPI stat numbers).
- **8pt spacing reached ARL** — the codebase-wide spacing retrofit covered
  ARL; only a single fine-grained spacing hit remains. Not a finding.
- **Selected-state, done right** in the sidebar nav and page indicator
  (solid `--hub-red` fill) — the Finding 4 cases are drift from this, not a
  missing pattern.
- **Mobile is a real restructure, not a shrink** — sidebar becomes a drawer
  with a scrim, content stacks vertically (Section 4 ✓), not a squeezed
  desktop layout.
- **No purple-blue gradients, no gradient text, no neon glow, no cream/serif
  "tasteful default"** anywhere in ARL.
- Categorical color in charts/avatars/conversation-type is a legitimate
  use, not an unconsidered default (same conclusion as prior audits) —
  except the one banned violet hex in the chart palette (Finding 3).

## Recommended order of attack

Mirror the dashboard audit's sequencing — mechanical, low-risk sweeps
first, design decisions last:

1. **Hover→active sweep** (Finding 1) — mechanical, highest value, same as
   the login/dashboard sweeps. Move the hover treatment to `active:`, or
   drop it where there's no real press equivalent.
2. **IconTip pass** (Finding 2) — replace `title=` on icon-only controls
   with `IconTip`; add labels to the unlabeled ones. The component already
   exists.
3. **Finish the indigo→teal migration** (Finding 3) — port `remote-viewer`
   and `remote-management` to `--hub-teal`; replace the arbitrary indigo
   accents in `meeting-analytics`/`data-management` with semantic or
   neutral colors; swap the violet chart hue.
4. **Selected-state + numeric-font drift** (Findings 4, 5) — match the
   patterns ARL already implements correctly elsewhere.
5. **Extract shared components** (Finding 8) — `StatusDot`, destructive
   `IconButton`, `EmptyState`, `ModalHeader` — to stop the drift recurring.
6. **Elevation pass** (Finding 10) — drop resting card shadows for flat
   fill/border contrast, standardize one modal depth, and replace the
   active-tab shadow lift with a solid fill. Pairs naturally with the radius
   system pass below.
7. **Design decisions, deferred to a real pass** — the radius system
   (Finding / scanner `rounded-everything`), the broadcast gradients
   (Finding 6), hierarchy on the overview KPI cards, and the silent-failure
   flow fixes (Finding 9). These need decisions, not a find-and-replace.
