# ARL Console Refactor Plan (2026-06-28)

Scope: **ARL Console only.** The kiosk/Main Dashboard is not part of this
plan — it's in the shape the user wants already.

This plan exists because two prior audit passes (`ARL-AUDIT-PLAN.md` and
its predecessors) checked DESIGN.md Sections 1-12 and 14-17 file-by-file
and fixed nearly everything they found. Sections **0** (the four
decisions, specifically layout intent) and **18** (earned presence) were
never run as their own deliberate pass — they showed up opportunistically
in a handful of findings (the Overview ticker/feed merge, the duplicate
trend chart) but not systematically across every screen. This plan is
that pass, plus the few items it surfaced that the prior plan logged but
never implemented.

**Verification method**: every file below was either re-read directly or
spot-checked against the prior plan's "done" claims. One stale claim was
found and corrected (`task-virtual-list.tsx`, see below) — everything
else the prior plan marked "done" is confirmed accurate.

---

## What's already correct — don't touch

Confirmed via direct re-read, applying Section 0's layout-intent question
("what's the job, what shape is the data, does the structure serve it")
fresh to each:

| Screen | Job | Data shape | Verdict |
|---|---|---|---|
| `tenant-settings.tsx` | Edit a finite set of org settings | Finite-vocabulary fields | Tabs by edit cadence already match the job |
| `task-manager.tsx` | Find/create/edit a task | Filterable, ranked list | Filter + templates + virtual list serve it |
| `locations-manager.tsx` | Scan location status, act on one | Tabular records | Real `<table>` already in place |
| `user-management.tsx` | Manage ARL/location accounts | Tabular records | Real `<table>` + overflow menu already in place |
| `messaging.tsx` + row/modal | Scan conversations, read/send | Freeform threads | Correctly not tabularized |
| `analytics-dashboard.tsx` | Explore trends, compare locations | Time-series + ranked list | Charts/date-range controls serve it |
| `arl-calendar.tsx` | See what's due when | Timeline | Calendar grid, not a table — correct |
| `broadcast-launcher.tsx` / `-studio.tsx` | Configure and start one broadcast | Simple form | Correctly unadorned |
| `emergency-broadcast.tsx` | Send urgent alert, confirm it landed | Compose + status + history | The console's reference example — weight+color+position already working together |
| `forms-repository.tsx` | Find/share a PDF form | Tabular | Real `<table>` already in place |
| `remote-management.tsx` / `-viewer.tsx` | See who's online, mirror a screen | Action-launcher tiles | Correctly not a table (not comparable fields) |
| `data-management.tsx` | Run/find a maintenance operation | Independent tool grid, severity-varying | Severity-tiered + disclosure-gated, already correct |
| `data-management-audit-log.tsx` | Scan/search an event log | Tabular | Real `<table>` already in place |
| `data-management-health.tsx` | See system status at a glance | Flat finite set of counters | Stat-grid is justified *by the data shape itself* here — not a genre default |
| `task-form-modal.tsx` | Define one task | Grouped form fields | 2-col grid, solid-fill selected states, spacing tiers all confirmed present |

**Correction to the existing audit, then a real bug found on top of it**:
`ARL-AUDIT-PLAN.md` lists `task-virtual-list.tsx` as still needing a
cards→table conversion. That part is stale — the desktop view already had
a real grid-column layout with a header row. But a live screenshot of it
surfaced a genuine, un-flagged Section 18 + Section 11 violation the file
read alone missed: the desktop row rendered **Priority twice** (an inline
chip next to the title, and again in its own "Priority" column) and
**"Recurring" twice** (an inline chip next to the title, and again as a
line in the Schedule column) — the exact same fact, twice, in one row.
The two single-chip-wide columns (Type, Priority) were also what made the
table look sparse/misaligned, with a large dead gap before them.

**Fixed**: collapsed the 5-column grid (`Task | Type | Priority | Schedule
| Actions`) to 3 (`Task | Schedule | Actions`). Type and Priority are
finite-vocabulary fields (Section 11 — encode as a chip, not a dedicated
column) and now live only as chips next to the title, matching what the
mobile card already did correctly. Recurring now appears only in the
Schedule column. `GRID_COLS` changed from `"2fr 1fr 1fr 1.5fr auto"` to
`"minmax(0,1fr) 220px auto"`.

---

## New findings — Section 18 (earned presence), not previously caught

### 1. `meetings/page.tsx` — two redundant "live" indicators

- **`:42`** — a pulsing white dot on the "Go Live" button restates what
  the button's own label already says. Same family as the Live Activity
  Feed dot that was already removed elsewhere in the console — missed
  here.
- **`:48`** — a pulsing green dot next to the "Active Meetings" heading
  restates both the heading text and the fact that the section only
  renders when `activeMeetings.length > 0`. If it disappeared, the user
  loses nothing — the heading and the section's mere presence already
  say "there's an active meeting."

**Fix**: remove both dots. The label and conditional rendering already
carry the signal.

### 2. `meeting-analytics.tsx` — 8 equal-weight stat cards, promotion never implemented

`ARL-AUDIT-PLAN.md` (line 81) recommended promoting 1-2 headline stats
(Total Meetings, Avg Duration) above the rest "if this component is being
touched anyway" — it was touched (for the tab split), but the promotion
itself was never done. All 8 `StatCard`s at `:386-393` (summary) and
`:177-184` (detail view) remain visually identical. This is a real,
unactioned Section 7/18 gap: a flat 8-stat row reads as a genre default
("dashboards have a stat row") rather than a structure that tells you
which numbers matter most.

**Fix**: promote Total Meetings + Avg Duration to a larger size in both
locations; demote the other 6 to the existing smaller tier.

### 3. `notification-settings-panel.tsx` — still framed around a bell the team already decided to remove

`ARL-AUDIT-PLAN.md`'s "Logged for follow-up" section already decided:
remove `NotificationBell`/`NotificationPanel` from desktop chrome
entirely (nothing it surfaces isn't already visible elsewhere on
desktop), and reframe this settings panel as "what gets pushed to your
phone" rather than "what shows in your bell." That decision was never
implemented:

- The page header and copy still describe "what notifications you
  receive" in bell terms.
- The in-app/bell toggle (`:81-84`, "Show in notification bell within
  the app") will be dead weight on desktop the moment the bell is
  actually removed — it's already arguably dead weight today, since the
  decision to remove it was made.

**Fix**: implement the bell removal (see #4) and reframe this panel's
copy/toggles to match — "what gets pushed to your phone," configurable
from either device, no bell-specific toggle on desktop.

### 4. `arl/layout.tsx` — `NotificationBell` still renders unconditionally on desktop

Confirmed still present at `:156`, gated by nothing. This is the same
decided-but-unimplemented item as #3 — recorded here as the other half
of the same fix (remove the import/render on the `isMobileOrTablet`
branch point already used for `SettingsPanel`/`PageIndicator`, not
conditionally hide it).

### 5. `arl/layout.tsx` — Quick Settings popover, minor/optional

Connection Status (changes constantly), Theme (rarely touched), and
Push Notifications (rarely touched) sit in one popover at equal visual
weight (`:180-271`) — a smaller instance of the same "settings cog"
pattern DESIGN.md names for Data Management's old structure. Lower
priority than #1-4: this is a 3-item popover, not a 6-action inline
reveal, and the existing audit already called this optional. Worth doing
if the file is being touched for #4 anyway; not worth a dedicated pass.

### 6. Tabs/segmented-switcher pattern — two implementations, not one (Section 15)

User-reported, confirmed by direct read: `tenant-settings.tsx` and
`meetings/page.tsx` both use the shared shadcn `Tabs`/`TabsList`
component (same default variant — these two are actually consistent with
*each other*). `user-management.tsx`'s ARLs/Locations switcher
(`:311-325`) is a completely separate, hand-rolled implementation —
`flex gap-1 rounded-xl bg-muted p-1` with `flex-1` buttons — that never
imports `Tabs` at all. The visible symptom is exactly what it looks like:
one pattern is `w-fit` (inline width), the other spans its container,
because they're not the same component.

**This is squarely what the Ark UI Tabs decision (DESIGN.md §15,
Underline) needs to fix, but only if done deliberately**: swapping the
two existing shadcn `Tabs` usages over to Ark UI Tabs while leaving
`user-management.tsx`'s bespoke switcher untouched would still leave two
implementations, just with one of them rebuilt. The fix is to migrate all
three usages onto one Ark UI Tabs component, styled Underline, including
rebuilding `user-management.tsx`'s switcher on it rather than re-skinning
its custom markup in place.

---

## Already logged, still genuinely open (not new, just not yet done)

Carried forward from `ARL-AUDIT-PLAN.md`'s "Logged for follow-up"
section — confirmed still accurate, included here so the punch list is
complete in one place:

- **Overview as a true single-viewport dashboard.** Confirmed still a
  scrolling page (`src/app/arl/page.tsx` wraps it in `overflow-y-auto`).
  This is a genuine Section 0 layout-intent gap — the job is "glance at
  status without scrolling," the structure doesn't serve that — but it's
  a real layout decision (fixed-height grid with each section owning an
  allocated region, closer to the kiosk's own grid system) rather than a
  small fix. Scheduled as its own phase below, not folded into the
  smaller fixes.
- **`scheduled-meetings.tsx`** — still card-per-row for genuinely tabular
  data (host/date/time/code). Convert to the same table+mobile-card
  pattern already used by `locations-manager.tsx`/`forms-repository.tsx`.
- **`meetings/page.tsx`** Start Meeting / Schedule Meeting buttons sit at
  near-equal weight despite differing frequency (ad hoc vs. planned).
  Logged as "soft/minor," do in the same pass as the dot removals above
  since it's the same file.
- **App-wide dark-mode swatch sweep** — re-confirmed remaining instances
  during this pass: `arl-calendar.tsx` task pills (`:196-197, 227,
  230-231`), `data-management-health.tsx` integrity/duplicate cards
  (`:89, 100`). Same fix as everywhere else this was found (swap to the
  opacity-based `bg-*-500/10 dark:bg-*-500/20` pattern already correct
  elsewhere) — batch whenever convenient, no new pattern needed.
- **Go Live broadcast bugs** (mic/camera prompt for passive viewers,
  navbar z-index overlapping video, no dedicated viewer-only component) —
  functional bugs, not a Section 0/18 finding, but still open and worth
  sequencing since they block the broadcast feature from working
  correctly regardless of visual polish.

---

## Component primitive migration (Ark UI) — the execution layer underneath all of the above

Separately decided earlier in this refactor (see `DESIGN.md` §2 and §15):
when any of the screens above get touched, they should be built on these
already-decided primitives, not shadcn/Radix or a raw native browser
control:

- **Primary action color**: chromatic neutral (near-black on light /
  near-white on dark) — not brand red.
- **Tabs**: underline indicator.
- **Text inputs**: bordered.
- **Select**: Ark UI Select everywhere, replacing native `<select>`.
- **Dropdown/kebab menus**: Ark UI Menu, replacing ad hoc implementations.
- **Dialog**: Ark UI Dialog.
- **Status badges**: no primitive needed — plain dot + label (DESIGN.md
  §10), already correct everywhere it's used in the console.

None of this has been rolled into the live app yet — `src/components/ui/*.tsx`
is still shadcn/Radix.

### Native browser primitive inventory — ARL Console

A direct sweep for native controls that should be Ark UI instead (the gap
the user flagged directly — "some dropdown menus... using the browser's
built-in library, not Ark UI"). No native `<dialog>` or `window.confirm`/
`alert` found in the console — those are clean. Three categories remain:

**Native `<select>` (6 in-console, 2 out-of-scope):**

| File:line | Used for |
|---|---|
| `task-manager.tsx:172` | Task filter |
| `tenant-settings.tsx:476` | Timezone picker |
| `arl-calendar.tsx:149` | Calendar filter |
| `user-management.tsx:639` | Role/location field in a form |
| `task-form-modal.tsx:436` | Form field |
| `scheduled-meetings.tsx:321` | Recurring-meeting field |
| ~~`src/app/tasks/page.tsx:143,150`~~ | Out of scope — this route is the kiosk surface, not the console |

**Ad hoc custom dropdowns (real custom-built menus, not native `<select>`,
that should move to Ark Menu) — exactly three, confirmed by checking every
`MoreVertical`-triggered menu in the console:**

| File:line | What it is |
|---|---|
| `messaging.tsx:300` | Chat header overflow (Group Info / Search) |
| `user-management.tsx:413` | Row overflow, ARLs tab (Permissions / Delete) |
| `user-management.tsx:501` | Row overflow, Locations tab |
| `arl/layout.tsx:164` | Quick Settings popover (Connection / Theme / Notifications) |

(Correction: an earlier draft of this plan claimed `meetings/page.tsx`
had an overflow menu needing this fix — re-checked, it doesn't have one
at all. Removed from this list.)

**Native checkboxes (5) — lower priority, not previously decided, flagged
for consistency with "no un-styled native control" now that the sweep is
explicit:**

`group-info-modal.tsx:428`, `scheduled-meetings.tsx:340,377`,
`task-form-modal.tsx:300,480`. These aren't dropdowns, but they're the
same category of issue — a native control where Ark Checkbox would give
real styling control instead of relying on the browser's default
`accent-color` appearance.

**Recommendation**: do this migration together with each screen's content
fix where the file is already being touched (e.g. `user-management.tsx`'s
two row-overflow menus move to Ark Menu in the same pass as anything else
done to that file), rather than as a separate blanket pass — same
reasoning as the rest of this plan.

---

## Recommended sequencing

1. **`meetings/page.tsx` cleanup** — remove the two redundant pulsing
   dots (#1), tier Start/Schedule Meeting weight (logged item). Smallest,
   highest-clarity fix; do first.
2. **`meeting-analytics.tsx` stat promotion** — promote Total
   Meetings + Avg Duration in both the summary and detail view (#2).
   Independent of #1, can happen in parallel.
3. **Notification bell removal + settings panel reframe** (#3 + #4) —
   these two files must ship together (the panel's reframe only makes
   sense once the bell is actually gone). Do the Quick Settings popover
   cadence-grouping (#5) and its Ark Menu migration in the same
   `arl/layout.tsx` pass since it's a small, contained addition to a
   file already being touched.
4. **`user-management.tsx` + `messaging.tsx` Ark Menu migration** — move
   the three real ad hoc dropdowns (two row-overflow menus, one chat
   header overflow) onto Ark Menu. Independent of the above, can happen
   any time.
5. **Tabs convergence (#6)** — migrate `tenant-settings.tsx` and
   `meetings/page.tsx` off shadcn `Tabs` and `user-management.tsx`'s
   hand-rolled switcher onto the same Ark UI Tabs (Underline) component,
   in one pass across all three files so the fix doesn't just relocate
   the inconsistency. Bundle with `user-management.tsx`'s Ark Menu
   migration (#4) since it's the same file.
6. **Native `<select>` → Ark Select, in-console (6 sites)** — do
   per-file alongside other work on that file where possible
   (`task-form-modal.tsx` and `scheduled-meetings.tsx` already have other
   fixes queued in this plan; `tenant-settings.tsx`, `task-manager.tsx`,
   `arl-calendar.tsx`, `user-management.tsx` can be done standalone).
7. **`scheduled-meetings.tsx`** table conversion — same pattern as the
   three screens that already got this fix, lowest-risk of the remaining
   items. Bundle with its native `<select>`/checkbox migration (#6) since
   it's the same file.
8. **Go Live broadcast bugs** — functional, blocks a real feature;
   sequence based on how urgent the broadcast feature is to ship, not on
   design-system priority.
9. **Overview single-viewport redesign** — biggest single decision in
   this plan. Do last, deliberately: it's a layout architecture change
   (fixed-height grid, each section owning an allocated region) rather
   than a content fix, and benefits from the Ark UI primitive decisions
   above already being in use elsewhere so the new grid isn't built on
   a component foundation that's about to change again.
10. **App-wide dark-mode swatch sweep** — mechanical, no dependencies,
   fold into any of the above passes opportunistically or do as its own
   pass whenever convenient.

---

## Addendum (post-draft fix): `task-virtual-list.tsx` table was visibly broken

A live screenshot of the Tasks & Reminders table, taken after this plan's
first draft, surfaced the duplicate-Priority/duplicate-Recurring bug
described above before this plan was finalized — fixed immediately rather
than only logged, since it was a one-file, low-risk, high-confidence fix
once the cause was visible. Listed here for the record; no longer an open
item.
