# Dashboard Audit — 2026-06-26

**Status as of 2026-06-30: 4 of 5 findings resolved**, fixed and
verified (`tsc`/lint/tests clean) — see DESIGN.md's Changelog for the
corresponding entries. Finding 5 (documenting the categorical purple
color) is a deliberate, explicit deferral, not an oversight — see its
entry below. Kept below as a historical record, not an active punch
list; nothing here needs action beyond that one deferred item.

Audit of the live `/dashboard` surface against [DESIGN.md](DESIGN.md),
using `npm run design:scan` plus manual review. No code changes were
made as part of this audit — findings only, to plan the dashboard
redesign pass.

## Scope correction — read this first

The dashboard went through at least one prior restructuring where the
grid-widget system replaced an older, non-grid layout, but the old
layout's files were never deleted — `/dashboard/grid` was made the
canonical route and redirected to `/dashboard` rather than the other
way around. A naive scan of `src/components/dashboard/` would have
audited ~11 files that were no longer rendered by anything live.

**Removed 2026-06-26** (traced actual imports, confirmed zero live
references, no test files affected — see commit `9f02255`):
`layouts/focus.tsx`, `layouts/layout-props.ts`, `calendar-modal.tsx`,
`celebrations.tsx`, `motivational-quote.tsx`, `idle-screensaver.tsx`,
`mini-calendar.tsx`, `completed-missed.tsx`, `seasonal-theme.tsx`,
`minimal-header.tsx`, `live-ticker.tsx`. `timeline.tsx` was trimmed
rather than deleted — its `TaskItem` type is still imported by
`page.tsx`, `notification-bell.tsx`, `grid-tasks.tsx`, and
`widget-data.ts`; only the dead `Timeline` component was removed.

**Confirmed live** — `src/app/dashboard/page.tsx` plus everything it
actually imports: the full `src/components/dashboard/grid/` module
(`grid-dashboard.tsx`, `grid-context.tsx`, `grid-engine.ts`,
`layouts.ts`, `widget-container.tsx`, `widget-renderer.tsx`,
`widget-data.ts`, and the six widgets — `grid-clock`, `grid-calendar`,
`grid-tasks`, `grid-messages`, `grid-upcoming`, `grid-quote`), plus
`restaurant-chat.tsx`, `forms-viewer.tsx`, `emergency-overlay.tsx`,
`stream-viewer.tsx`, `remote-view-banner.tsx`, `arl-cursor-overlay.tsx`,
`remote/cursor-overlay.tsx`, `remote/mirror-toolbar.tsx`,
`connection-status.tsx`, `offline-indicator.tsx`.

This audit covers only the 25 live files. The dead files aren't worth
auditing — recommend deleting them in a separate pass so the next
person (human or model) doesn't repeat this same investigation.

## Scanner summary (scoped to the 25 live files)

```
files scanned: 25
findings: 70
vibe score: 155
verdict: "STRONG AI-default look"
```

| Rule | Hits | Assessment |
|---|---|---|
| `rounded-everything` | 31 | **Real — see "Radius inconsistency" below.** Unlike the login page (now a deliberate 3-tier container/control/circle system per DESIGN.md Section 3), the dashboard never got that pass. |
| `fade-in-animations` | 23 | **Mostly mount-transitions, not boilerplate scroll/hover decoration** — same false-positive category as the earlier login audit. Worth a pass to standardize durations (Section 9), not to delete. |
| `ai-purple` | 11 | **Mixed** — several legitimate categorical uses, a few genuine arbitrary-default uses. See breakdown below. |
| `claude-default-look` | 4 | **All false positives** — fires on `bg-amber-*`, which here is legitimate semantic status/priority color, not the cream+serif tell. No serif font anywhere in the app. |
| `emoji-as-icons` | 1 | **Minor** — a ✅ emoji inside dynamic toast/notification *text* (`page.tsx:118`), not a UI icon control. Same category as the `funny-messages.ts` false positive from the earlier audit. Low priority. |

## Genuine findings (see status note above)

### 1. ~~Hover-only feedback~~ — **Fixed 2026-06-26**

`devibe-scan.py` has no rule for this because it's specific to this
product, not a general AI-slop pattern — but DESIGN.md Section 6 is
unambiguous: this is a touchscreen kiosk with no pointer device, so
`:hover` is never seen by a real user and risks the "stuck hover" bug
on touch browsers. **39 `hover:` instances across 6 live files**,
already fixed everywhere on the login page but never swept on the
dashboard:

| File | Count |
|---|---|
| `grid/grid-dashboard.tsx` | 15 |
| `restaurant-chat.tsx` | 11 |
| `remote/mirror-toolbar.tsx` | 8 |
| `emergency-overlay.tsx` | 2 |
| `grid/widget-container.tsx` | 2 |
| `offline-indicator.tsx` | 1 |

This is the single highest-value, lowest-risk fix available — same
mechanical pattern as the login page sweep (move the hover treatment
to `active:`, or drop it if there's no real press-state equivalent).

### 2. ~~Radius inconsistency~~ — **Fixed 2026-06-30**

Distribution across the 25 live files (at time of audit):

```
rounded-full   92
rounded-xl     46
rounded-lg     39
rounded-2xl    19
rounded-md     12
rounded-3xl     5
```

Six different radius scales in active use with no documented logic
tying them together — this is exactly the Do Not Use entry's
"inconsistent" case (Section 10), not the "deliberate heavy/uniform"
house style adopted for login. The dashboard needs the same
container/control/circle pass the login page already got.

**Resolution:** audited every instance role by role rather than by
raw distribution — most of the six scales turned out to already be a
coherent system once grouped by role (container vs. control vs.
circle), not unconsidered drift. Fixed the handful of real cross-file
mismatches (icon-avatar boxes, a size badge, a remove button, a
mini-calendar cell, three nav/close buttons, one toggle button) and
documented the resulting tiers in DESIGN.md Section 3 so it's a
checkable rule going forward, not an implicit pattern someone has to
re-derive.

### 3. ~~Arbitrary indigo, recurring across multiple files~~ — **Fixed 2026-06-26**

Indigo shows up repeatedly with no stated semantic meaning, the same
pattern already fixed once on the login page (the old confirm-dialog
variant, the loading spinners):

- **`page.tsx:289`** — `border-indigo-500` loading spinner. Identical
  issue to the one already fixed on login; this is effectively the
  same bug not yet ported over.
- **`arl-cursor-overlay.tsx:74,78`** — indigo badge + indigo
  `animate-ping` ring for the "an ARL is remotely viewing" cursor
  indicator. No stated reason indigo specifically means "ARL presence"
  — every other semantic color in the app is already claimed (red =
  brand/urgent, amber = priority/warning, emerald = success/connected).
- **`remote/mirror-toolbar.tsx`** — the entire floating remote-mirror
  toolbar is styled in indigo (border, background tint, icon color,
  active-state ring) — `mirror-toolbar.tsx:102,136,149,207`. This is
  one whole UI surface running on an unconsidered default, not just a
  one-off element.
- **`remote-view-banner.tsx:102`** — `isControl ? amber : indigo` as a
  two-state toggle. Amber is a real, established color; indigo is
  filling the "other" slot by default, not by decision.

### 4. ~~Decorative-leaning blur on small floating panels~~ — **Fixed 2026-06-30**

Most `backdrop-blur` usage on this surface is structural and correct
(full-screen modal scrims at `bg-background/80 backdrop-blur-sm`
behind a true modal — `grid-calendar.tsx`, `grid-tasks.tsx`,
`widget-container.tsx`). Two instances are more decorative than
structural and worth a second look:

- **`grid-dashboard.tsx:137,200`** — small dropdown menus
  (`bg-card/95 backdrop-blur-md`) where nothing is actually moving or
  scrolling behind them — the same pattern already removed from the
  login page's old background-picker dropdown.
- **`remote/mirror-toolbar.tsx:101,136`** — `backdrop-blur-xl` on a
  floating toolbar over the live screen-mirror view. Arguably
  structural (the toolbar needs to stay legible over a busy/moving
  mirrored screen), but it's the heaviest blur value in the app and
  paired with the indigo tint above — worth a deliberate look rather
  than inheriting both by default.

**Resolution:** both removed. The two `grid-dashboard.tsx` dropdowns
were already on a near-opaque `bg-card/95` so the blur was doing
almost nothing visually, and the established `Menu`/`Select`
dropdowns elsewhere use solid fills with no blur at all — switched to
match. `mirror-toolbar.tsx` turned out to be stacking blur with a
pulsing glow-ring *and* a shadow on its collapsed pill — close to the
literal Do Not Use example for "stacking decorative effects with no
individual justification" — blur dropped from both states, fill
bumped to fully solid now that nothing needs blending into.

### 5. Undocumented categorical color system — **deliberately deferred, not resolved**

`restaurant-chat.tsx` and `forms-viewer.tsx` use purple as one entry in
a real categorical system (conversation/department type — location =
muted, group = purple, hr = purple). This is a legitimate use, not an
unconsidered default — same conclusion as the earlier login audit's
"ai-purple" false positives — but it exists nowhere as a documented
spec. Worth writing down once dashboard color decisions are made, so
future additions to the category list don't reintroduce arbitrary
choices.

## Non-findings worth noting

- No purple-to-blue gradients anywhere in the live set (the two
  instances found in the original full-codebase audit were both in
  now-dead files — `celebrations.tsx`, `motivational-quote.tsx`).
- No hero+three-card skeleton, no cream/serif "tasteful default," no
  emoji used as actual icon controls.
- The grid widget system's modal pattern (full-screen scrim +
  `rounded-3xl` panel) is consistent across `grid-calendar.tsx`,
  `grid-tasks.tsx`, and `widget-container.tsx` — this one pattern is
  already a deliberate, repeated convention, not something to redesign.

## Recommended order of attack

1. ~~Delete the 11 dead files~~ — **done 2026-06-26**, commit `9f02255`.
2. ~~Hover sweep~~ — **done 2026-06-26**, commit `a24ee5d` (39
   instances across 6 files, plus two real fixes beyond a mechanical
   swap — see commit message).
3. ~~Indigo cleanup~~ — **done 2026-06-26**, commit `ae99670`. Turned
   out to be one coherent feature (remote mirroring/viewing) using
   indigo by default throughout, not scattered arbitrary picks.
   Replaced with a deliberate `--hub-teal` token; documented in
   DESIGN.md Section 2's claimed-semantic-colors table.
4. ~~Decorative-blur cleanup~~ — **done 2026-06-30** — removed
   `backdrop-blur` from `grid-dashboard.tsx`'s two dropdowns and
   `mirror-toolbar.tsx`'s collapsed/expanded states (see DESIGN.md
   Changelog).
5. ~~Radius pass~~ — **done 2026-06-30** — applied the
   container/control/circle system and documented it in DESIGN.md
   Section 3 (see DESIGN.md Changelog).
6. **Document the categorical color system** — explicitly deferred
   2026-06-30, not scheduled. Purple turned out to carry several
   unrelated meanings app-wide (identity/role accent, decorative
   per-section accent, unrelated data categories), not just the one
   dashboard use this finding originally flagged — resolving it
   needs a real taste/policy decision, not a mechanical doc update,
   and was explicitly punted rather than guessed at.
