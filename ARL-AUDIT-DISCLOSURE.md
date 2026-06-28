# ARL Console Audit — Data Drives the UI & Progressive Disclosure (2026-06-27)

A focused second pass on top of [ARL-AUDIT.md](ARL-AUDIT.md), which covered
mechanical/visual conventions (hover states, IconTip, color tokens, shadows,
spacing). This pass is scoped to exactly two principles from
[DESIGN.md](DESIGN.md):

- **Section 11 — Data Drives the UI**: the screen's shape should come from
  the actual shape of the data, not a default table/list/card. Fixed-vocabulary
  fields become chips, not text columns. Numbers right-align. "What happened
  when" data is a timeline, not a sorted table. Color always encodes a real
  property — never sprinkled in for visual interest.
- **Section 12 — Progressive Disclosure & the Spectrum of Explicitness**:
  what's shown by default vs. revealed on demand should track how often/
  important an action is. Primary stays visible; secondary surfaces one tap
  in; rare gets tucked a step further. The named anti-pattern: many actions of
  different importance, all exposed at equal visibility the instant something
  is opened.

No code changes were made. All 14 ARL routes and their backing components
were reviewed; findings below are organized by severity, not by file, because
the user's actual question is "is this overwhelming and can routes combine" —
a cross-cutting judgment, not a per-file checklist.

## The honest headline

**You're right, and it's worse at the page/route level than at the
component level.** Individually, most components pick reasonable chip/badge
treatments for fixed-vocabulary fields — that part of Section 11 is mostly
fine across ARL. The real problem is Section 12: several routes stack
*everything they have* into one scroll with no tiering, and the sidebar
itself has no tiering either. The overwhelming feeling isn't death by a
thousand small cuts — it's a small number of pages that each dump 5-8
full-weight sections onto one screen, plus a flat 12-item nav with no sense
of "this is what you touch daily" vs. "this is config you set once."

## Finding 1 (highest severity) — Data Management is a 21-card wall with zero severity tiering

`src/components/arl/data-management.tsx:248-312`. Seven sections, 21 action
cards, **all rendered unconditionally on page load**, all the same visual
weight: card, icon, title, description, colored button. The destructive tier
(`Purge All Messages`, `Purge All Conversations`, `Purge Broadcast Data`,
`Purge Notifications`, `Drop Unused Tables`, `Clear All Completions`,
`Force Sign Out All` — irreversible, full data loss) sits in an identically
styled card grid as `Optimize Database` (safe) and `Export All Data`
(harmless read). The per-click confirm modal (`:412-431`) is the same modal
for all 21 — it gates the *click*, not the *page*, so it doesn't fix the
real issue: opening `/arl/data-management` exposes every dangerous operation
the product has, at once, with no "are you sure you want to see the
dangerous stuff" step.

This is also the worst Section 11 violation in ARL: `colorMap` (`:314-326`)
assigns **11 different colors** (red/orange/amber/yellow/green/blue/indigo/
purple/sky/slate/cyan) across the 21 cards with no shared scale — `vacuum`
gets green, `purge-old` gets orange, `orphaned` gets amber, `dupes` gets
yellow, four visually-distinct "this is fine" colors for what's actually one
severity tier (safe maintenance), while the truly destructive purges get the
same red as routine "clear stale sessions." This is color sprinkled in for
variety, the literal thing Section 11 prohibits — not color encoding a real
severity property.

**Recommendation**: collapse to two severity tiers, not seven feature
sections. A page that opens to "Cleanup & Maintenance" + "Backup & Export"
visible (safe, frequent), with "Destructive Actions," "Session Management"
(force sign-out), and "Task Operations" (bulk-clear) behind a single
"Show advanced / destructive operations" disclosure step. Recolor by
severity (e.g., neutral/slate for safe, amber for caution, red for
destructive) instead of one arbitrary hue per card.

## Finding 2 — The Meetings route stacks four unrelated things in one scroll

`src/app/arl/meetings/page.tsx:14-67`. On load: a "Go Live" broadcast CTA
(`:18-31`, a gradient button mid-page, not a header action), a conditional
"Active Meetings" panel (`:33-54`), the full `ScheduledMeetings` list
(`:56`), and — immediately below a `border-t`, no tab, no toggle —
`MeetingAnalyticsDashboard`, which `meeting-analytics.tsx:384-394` renders as
**8 stat tiles** (Total Meetings, Avg Duration, Avg Participants, Total
Messages, Total Reactions, Total Questions, Total Hand Raises, Total
Duration) before showing a single meeting. A user who opened this page to
join or schedule a meeting — the primary, frequent reason to be here — has
to scroll past a full analytics dashboard that's only relevant to someone
specifically reviewing meeting history.

**Recommendation**: analytics is a different *task*, not a continuation of
the same one — split into a tab (`Meetings` / `Analytics`) the way
`analytics-dashboard.tsx` already tabs Tasks vs. Messaging internally, or
move it under the existing Analytics nav item as a "Meetings" tab there.
Either way, it shouldn't be the thing every meetings-page visit scrolls past.

## Finding 3 — TickerPush and Live Activity Feed are the same concept, split into two cards (revised — see below)

**Correction:** the original version of this finding recommended moving
`TickerPush` to "Broadcast." That was wrong — `/arl/broadcast` and
`BroadcastStudio`/`BroadcastLauncher` are the live-video/meeting feature
(LiveKit rooms, meeting codes, one-way streams), unrelated to scrolling text
messages. Confirmed by reading `broadcast-studio.tsx`. Retracting that
destination entirely.

**The real finding, identified during follow-up discussion:** `TickerPush`
(`overview-dashboard.tsx:278-281`, compose/manage ARL-authored ticker
messages) and `LiveActivityFeed` (`:284-286`, task completions + new
messages) are presented as two separate cards on Overview, but the surface
they both ultimately feed — the kiosk's on-screen ticker — already treats
them as one merged stream: `dashboard/page.tsx`'s `GridTickerBar` listens to
**both** `task:completed` *and* `ticker:new` and interleaves them into a
single scrolling line (confirmed by reading that component). `LiveActivityFeed`
listens to the same `task:completed`/`message:new` events independently
(`live-activity-feed.tsx:74-75`). There's no reason the ARL-facing view
should split what the location-facing view already merges.

**Recommendation**: combine into one "Live Feed" panel on Overview — a
single scrollable list of completions/messages/ticker-pushes, with the
compose-a-ticker-message form as an inline expandable action within that
same panel (reusing `TickerPush`'s already-correct `showForm` disclosure,
`ticker-push.tsx:29`), not two separate cards doing adjacent jobs.

**Also found in the same component**: the "🟢 Live" pulsing-dot label
(`live-activity-feed.tsx:121-131`, next to a header already titled "Live
Activity") is decorative confirmation of something the real-time updates
already demonstrate on their own — remove it.

**Related, separately scoped**: the global task-completion toast
(`arl/layout.tsx`'s `toasts` block, fed by the same `task:completed` event
via `arl-dashboard-context.tsx:355-373`) fires on every ARL page, including
Overview — meaning on Overview specifically, the toast and the (now-merged)
Live Feed double-signal the identical event. The toast still earns its place
on every *other* page (it's the only cross-page awareness mechanism; the
feed only exists on Overview and has no equivalent elsewhere) — the fix is
to suppress the toast specifically while `activeView === "overview"`, not to
remove either mechanism app-wide.

## Finding 4 — Tenant Settings is one flat scroll for four sections with different edit cadences

`src/components/arl/tenant-settings.tsx:206-463`. Four sections — Plan info
(read-only), Branding (org name/app title/color picker/8 presets/live
preview), Timezone, Domain & Assets (Hub URL, custom domain, logo/favicon
URLs) — all expanded, all governed by one global Save button (`:173-196`).
These don't share a use frequency: branding and domain setup are
plausibly-once, timezone changes rarely, plan info is never edited at all
here. Per Section 12's own logic, bundling a near-never-touched field
(Favicon URL, `:445-452`) at the same scroll distance as a field someone
might revisit (Brand Color, `:286-314`) is the named anti-pattern. The page
already uses one good convention to build on — each section is its own
bordered card with an icon+title (`:211, 253, 359, 393`) — so this is a
disclosure refactor (tabs or accordion), not a content redesign.

## Finding 5 — Per-row destructive actions sit at equal weight to routine ones

Three separate places, same pattern:
- `user-management.tsx:376-405` — Permissions, Edit, Activate/Deactivate,
  and **permanent Delete** render as four identically-sized icon buttons in
  one row, always visible. Delete is irreversible (confirmed by the existing
  confirm-dialog gate at `:268-286`) but has the same visual prominence as Edit.
- `task-virtual-list.tsx:112-137` — Eye/Pencil/Trash2, same equal-weight
  pattern; Edit is the frequent action, Delete is rare and destructive.
- `group-info-modal.tsx:515-527` — Leave/Delete Group, the single most
  destructive action in the whole modal, sits one `border-t` below the
  read-only member list at full-width, full-visibility — same scroll-reachability
  as viewing members.

None of these need a confirm-dialog fix (most already have one) — they need
the *entry point* moved, not gated. Group rare/destructive actions behind a
single "..." overflow per row, consistent with how this audit's companion
doc already recommends a shared destructive-`IconButton` (ARL-AUDIT.md
Finding 8) — the disclosure fix and the component-drift fix are the same
piece of work.

## Finding 6 — The conversation header in Messages has 5 equal-weight actions

`messaging.tsx:251-294` — Back, Group Info, Search, Mute/Unmute all render
inline at identical visibility the instant a chat opens. Group Info and
in-thread Search are squarely Section 12's "secondary, reach for it when you
need it" tier; pinning them permanently next to Back (used every time) and
Mute (occasional but binary) is the same six-actions-at-once shape DESIGN.md
already names for the settings cog. Fold Group Info + Search into a single
overflow control next to Mute.

## Finding 7 — Overview partially restates Analytics instead of linking to it (direction corrected)

Confirmed by direct comparison: Overview's 7-day trend chart
(`overview-dashboard.tsx:247-276`) and Analytics' Tasks-tab "Completion
Trends" chart (`analytics-dashboard.tsx:323-333`) are the same fact —
completion rate over time — computed twice. **Overview is the one that
should give it up, not Analytics**: Overview is the glanceable status page,
Analytics is the canonical deep-dive surface this whole console already
treats as authoritative for trend data (it has date-range controls Overview
doesn't, `analytics-dashboard.tsx:223-229`). Earlier wording of this finding
had the direction backwards (recommended deleting Analytics' copy and
keeping Overview's) — corrected per direct user feedback.

This is **not** a case for deleting the Analytics nav item generally:
`meeting-analytics.tsx`'s 8-stat overview, the Messaging tab, the
hour-of-day pattern chart, and CSV export have no Overview equivalent at all
and are genuinely used by a different motion (someone specifically reviewing
performance, not glancing at status).

**Recommendation**: delete the 7-day trend chart from Overview entirely;
replace it with a "View full analytics" link pointing at `/arl/analytics`.
The Location Performance list (`overview-dashboard.tsx:219-245`) sits right
next to it and has the same kind of overlap with Analytics' "Top Locations"
chart — flagged here as the same category of question, but not folded into
this recommendation since it wasn't specifically called out; worth a
separate decision rather than assuming the same answer applies.

## Finding 8 — The sidebar itself has no tiering: 12 flat, equally-weighted nav items

`arl-sidebar.tsx:35-48`. Overview, Messages, Tasks & Reminders, Calendar,
Locations, Meetings, Emergency Broadcast, Users, Remote, Data Management,
Analytics, Organization — twelve items, one list, no grouping, no visual
distinction between "you're in this daily" (Overview, Messages, Tasks) and
"you set this up once and rarely return" (Organization/tenant-settings,
Data Management). This is Section 12's spectrum violated at the IA level,
the same root cause as Findings 1-4 but at the navigation layer instead of
the page layer — and arguably the place a real fix should start, since
fixing the nav grouping makes several of the page-level fixes feel less
urgent (an "Administration" cluster that's visually one step down from
"Operations" already signals "these is config, not daily work" before the
user even opens Data Management or Organization).

**Recommendation**: group into two or three labeled clusters (e.g.
*Operations*: Overview/Messages/Tasks/Calendar/Locations/Meetings/Emergency;
*Administration*: Users/Remote/Data Management/Analytics/Organization) with
a small section label, not a new nav level — same flat list, just with
visual breathing room marking the tier change. This alone would address a
meaningful share of "there's too much here" without touching a single route.

## What's already correct — don't fix what isn't broken

- **Tasks vs. Calendar are genuinely not redundant.** `task-manager.tsx` is
  a CRUD list (create/edit/delete/hide, no date resolution); `arl-calendar.tsx`
  is a read-only recurrence-resolved month timeline (`calTaskApplies`,
  `arl-calendar.tsx:52-99`) with zero mutation actions. Different shapes of
  the same underlying data, correctly split — exactly what Section 11 asks
  for, not a merge candidate. The only real overlap is an unextracted
  location-filter `<select>` implemented twice — a code-reuse note, not a
  UI-redundancy problem.
- **Locations and Remote already disclose correctly.** Locations' two
  per-card actions (PIN reset, sound mute) are roughly equal-frequency, and
  PIN reset expands inline rather than dumping fields by default
  (`locations-manager.tsx:304-336`). Remote's view/control toggle is cleanly
  tiered with nothing further to hide.
- **Emergency Broadcast already gates its rare views correctly** — Viewer
  breakdown and Broadcast History are both behind toggles
  (`emergency-broadcast.tsx:215-228, 382-391`), not dumped by default. This
  is the pattern Findings 1-4 should be matching.
- **Task creation's primary/secondary split is right** — "New Task" stays
  visible, "Templates" is a one-tap collapsed toggle (`task-manager.tsx:182-189`).
- Chip-vs-text for fixed-vocabulary fields (role, status, conversation type,
  priority, member role) is correctly chips, not plain text, in essentially
  every file reviewed — the Section 11 finding here is narrow (data-management's
  color sprinkling, audit-log's uncolored action-type field, a few unaligned
  numeric columns), not systemic.

## Secondary Section 11 notes (lower priority, fold into other passes)

- `data-management-health.tsx:81, 122` and `tenant-settings.tsx:227, 231` —
  numeric values aren't right-aligned, though most are isolated single
  numbers in their own tile rather than stacked columns, so severity is low.
- `data-management-audit-log.tsx:90` — `action` field (purge/clear/archive/
  etc., a small fixed vocabulary) renders as a plain monospace pill, not
  color-coded by action type, despite `user_type` two columns over correctly
  being a colored chip (`:81-86`). Same file's timestamp list is flat-sorted,
  not date-grouped — partial credit against the timeline guidance, not a
  full miss.
- `task-virtual-list.tsx:63-65` — task `type` renders as an outline badge
  with no color mapping, while `arl-calendar.tsx` already has a working
  type→color scheme for the same field. Reuse it.
- `messaging.tsx:415-445` — the "who's read this" breakdown is flat-bucketed
  (Read by / Not yet read) with no per-person read timestamp ordering,
  despite read-receipts being inherently "who did what when" data. Low
  severity given typical list size.

## Recommended order of attack

1. **Sidebar grouping (Finding 8)** — cheapest, most leveraged; re-frames
   the whole console before touching a single route.
2. **Data Management severity tiering + recoloring (Finding 1)** — highest
   real risk (irreversible operations at parity with safe ones).
3. **Meetings tab split (Finding 2) + Overview's Ticker/Activity merge (Finding 3)**
   — both are "this page is doing two jobs at once," same fix shape.
4. **Tenant Settings disclosure (accordion/tabs) (Finding 4)**.
5. **Destructive-action overflow grouping (Finding 5)** — bundle with the
   shared destructive-`IconButton` extraction ARL-AUDIT.md already calls for.
6. **Messages header overflow (Finding 6)**.
7. **Analytics de-duplication (Finding 7)** — delete the redundant
   7-day-trend chart from **Overview** (Analytics is the canonical deep-dive,
   not the other way around — corrected from this finding's original
   direction), replace with a "View full analytics" link from Overview to
   Analytics instead.
8. Secondary Section 11 polish — fold into whichever pass touches each file.
