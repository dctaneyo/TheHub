# ARL Console — Consolidated Implementation Plan (2026-06-28)

Your instinct was right, and the answer to "is there overlap" is: **yes, heavily** —
to the point that auditing the remaining principles changes the recommended
fix itself, not just the punch list. This document merges three audit passes:

1. [ARL-AUDIT.md](ARL-AUDIT.md) — Sections 1-3, 6, 9, 10, 14-17 (mechanical/visual: hover, color tokens, shadows, icons, selection state, component drift, silent failures).
2. [ARL-AUDIT-DISCLOSURE.md](ARL-AUDIT-DISCLOSURE.md) — Sections 11-12 (data shape, progressive disclosure).
3. This pass — Sections 4, 5, 7, 8 (layout grid discipline, white space/proximity, visual hierarchy, dark mode depth), the four sections neither prior doc touched.

All 17 numbered DESIGN.md sections have now been checked against ARL. Organized **by file**, not by principle, because that's the actual implementation unit — touching `data-management.tsx` once to fix everything it has wrong beats three separate passes that each touch it for one principle.

## The headline finding: a small number of files fail almost every principle at once, for one shared root cause

This is the concrete answer to "should we audit everything before implementing." `data-management.tsx`, `tenant-settings.tsx`, and the Overview/Meetings landing pages aren't six unrelated small problems each — they're **one structural decision** (a flat, undifferentiated wall of equal-weight cards/sections) that independently trips nearly every principle in the doc:

| File | 1 Type | 2 Color | 3 Spacing | 4 Layout | 5 Proximity | 7 Hierarchy | 8 Dark mode | 11 Data shape | 12 Disclosure |
|---|---|---|---|---|---|---|---|---|---|
| `data-management.tsx` | — | ✗ (indigo, ARL-AUDIT §3) | ✓ (shadow pass done) | ~ (uneven grid fill) | **✗ no escalation** | **✗ color-only** | **✗ 10/11 unpaired** | **✗ rainbow colorMap** | **✗ 21 cards flat** |
| `tenant-settings.tsx` | — | — | — | — | **✗ uniform across 4 sections** | — | ~ (paired but flat) | — | **✗ 4 sections flat** |
| `overview-dashboard.tsx` (home) | — | — | — | — | **✗ uniform across 5 blocks** | **✗ KPI cards color-only** | ✓ (clean) | — | **✗ Ticker/Activity split + duplicate trend chart** |
| `task-form-modal.tsx` | — | drift (tint+border, ARL-AUDIT §4) | — | **✗ 5 uncoordinated flex configs** | ✗ uniform `space-y-4` | **✗ selected state color-only** | ✗ (one unpaired amber) | — | **✗ all fields equal weight** |
| `user-management.tsx` | — | — | — | ✗ (permissions modal drift) | **✗ uniform group spacing** | **✗ role chips color-only** | ✗ (one unpaired) | ✓ chips correct | **✗ 4 row actions equal weight** |
| `arl-sidebar.tsx` (nav) | — | — | — | ✓ | ✓ (dividers, fine) | ✓ (selection correct) | ✗ (one unpaired badge) | — | **✗ 12 flat items** |

A single redesign pass on each of these rows — not six sequential principle-by-principle patches — is the efficient path. The rest of this doc gives the per-file worklist; the table above is the prioritization.

---

## File-by-file worklist

### `data-management.tsx` — highest priority, touches every principle

- **Structure**: collapse 7 feature-sections into 2 severity tiers (safe/frequent visible by default; destructive/rare behind one "Show advanced operations" disclosure step). Fixes §12.
- **Color**: replace the 11-color `colorMap` (`:314-326`, only `slate` is dark-aware) with a 2-3 color severity scale (neutral/amber/red) reused consistently — fixes §11's color-sprinkling, §8's 10 unpaired swatches, and the existing §2 indigo finding (`clear-offline`/`archive-tasks`) in one move, since they're all instances of the same `colorMap`.
- **Hierarchy**: once recolored by severity, also vary weight/border (e.g. destructive cards get a heavier red border, not just a red icon chip) so removing color still leaves the severity signal — fixes §7's color-only finding.
- **Spacing**: once collapsed to 2 tiers, give the destructive tier a visually larger separation (not just a different `<details>`/disclosure container, an actual wider gap before it) — fixes §5.
- **Alert banners** (`:349, 356`) — add `dark:` pairs while in the file anyway.

### `tenant-settings.tsx`

- **Structure**: split 4 sections (Plan/Branding/Timezone/Domain&Assets) into tabs or accordion, Branding+Plan visible by default, Domain&Assets/Timezone collapsed. Fixes §12.
- **Spacing**: this alone won't fix §5 — even after tabbing, make sure the *visible* tab's internal field grouping varies spacing by relationship (tighter within Branding's 5 sub-fields, looser between Branding and whatever's below it) rather than the current uniform `space-y-4`/`space-y-6` throughout. Fixes §5.
- Already dark-mode clean (no unpaired colors found) — don't touch §8 here, not broken.

### `overview-dashboard.tsx` (Overview/home)

- **Merge `TickerPush` + `LiveActivityFeed` into one "Live Feed" panel** (Finding 3, disclosure doc, corrected — *not* a move to Broadcast, that was a wrong destination in an earlier pass of this plan). The kiosk-facing `GridTickerBar` already merges task completions and ARL-pushed messages into one stream; the ARL-facing Overview shouldn't split what the destination surface already treats as one feed. Also remove the "🟢 Live" pulsing-dot label inside `LiveActivityFeed` (`:121-131`) — decorative confirmation of something the real-time updates already show. This single merge is also the biggest §5 win available here: it removes one of the five uniformly-spaced blocks outright, rather than just adjusting spacing between them.
- **Delete the 7-Day Completion Trend chart** (`:247-276`) — duplicates Analytics' Tasks-tab trend chart; Analytics is the canonical deep-dive (has date-range controls this chart doesn't), Overview should link to it instead of recomputing it. Replace with a "View full analytics" link. (Location Performance list is a related, not-yet-decided question — same category of overlap with Analytics' "Top Locations" chart, flagged separately.)
- **Suppress the global task-completion toast specifically on this page** — `arl/layout.tsx`'s toast and the (now-merged) Live Feed both fire off the same `task:completed` event; redundant only here, since the toast is the only cross-page awareness mechanism everywhere else. Gate it on `activeView !== "overview"`.
- **KPI cards**: add a real hierarchy signal beyond border color when there's a problem — e.g. when `overdueCount > 0`, that card should be visually larger/bolder, not just red-bordered like the other two are green/amber-bordered. Fixes §7's color-only finding.
- Sparkline inline SVG colors (`:210`) — low-priority §8 note, shared root cause with the app-wide chart-color/token issue below, not worth a one-off fix here. (Moot once the trend chart itself is deleted.)
- Otherwise dark-mode clean — don't over-fix what isn't broken.

### `task-form-modal.tsx`

- **Layout**: standardize the 9 field groups onto one shared 2-column grid (label-left or label-above, consistently) instead of 5 different ad-hoc flex configs. Fixes §4.
- **Selected-state color-only**: Type/Priority/RecurringType/AssignMode/Location button-groups all rely on `border-[var(--hub-red)] bg-[var(--hub-red)]/10` alone for "selected" — this is the same fix as ARL-AUDIT.md's existing Finding 4 (tint+border drift), and fixing it to a real selected/unselected shape difference (not just color) closes the §7 color-only gap at the same time. One fix, two principles.
- **Spacing**: differentiate `space-y-4` between truly-related groups (Type+Priority) vs. unrelated ones, once the layout grid lands — do this in the same pass, not separately.
- `text-amber-600` helper text (`:501`) — add `dark:` pair while editing this file anyway.

### `user-management.tsx`

- **Row actions**: group Permissions/Delete (rare) into one overflow control, leave Edit/Activate visible — this is the same fix already recommended in the disclosure doc's Finding 5, and it simultaneously fixes §7 (fewer equal-weight icons competing) since there'll only be 2 visible instead of 4.
- **Permissions modal**: align the role-template/location/permission group cards to one consistent layout (currently each codes its own flex row, causing toggle-position drift) — fixes §4 — and differentiate spacing between the 3 structurally-separate groups vs. rows-within-a-group — fixes §5.
- `bg-red-50` error banner (`:546`) — add `dark:` pair (the identical pattern already exists correctly in `tenant-settings.tsx:200`, just copy it).

### `arl-sidebar.tsx`

- **Grouping**: split the 12 flat nav items into 2 labeled clusters (Operations / Administration) per the disclosure doc's Finding 8 — this is purely a §12 fix, but do it in the same pass as anything else touching this file since it's a small, contained change.
- `bg-emerald-100 text-emerald-700` online-count badge (`:162`) — add `dark:` pair while in the file.

### `arl/layout.tsx` (shell)

- Task-completion toast icon chip `bg-emerald-100` (`:364`) has no `dark:` pair while the structurally identical `notifToast` two blocks down (`:386`) does — copy that pattern over. Small, isolated fix.
- Quick Settings popover bundles Connection/Theme/Notifications with uniform dividers (`:171-271`) — this is another, smaller instance of the same "settings cog" pattern DESIGN.md already names; low priority relative to Data Management's version of the same issue, optional cleanup if touching this file for the toast fix anyway.

### `arl/meetings/page.tsx` + `meeting-analytics.tsx`

- Split into tabs (Meetings / Analytics) per the disclosure doc's Finding 2 — fixes §12.
- While doing that split: the 8 stat tiles in `meeting-analytics.tsx` (`:386-393`) are all visually identical (§7 color-only finding) — if this component is being touched for the tab split anyway, promote 1-2 headline stats (Total Meetings, Avg Duration) to a larger size and demote the rest, same pass.
- Note for later, not now: the "Go Live" CTA and "Active Meetings" panel both pulse simultaneously when a meeting is live, diluting which is more urgent — minor, defer.

### `messaging.tsx`, `swipeable-convo-row.tsx`, `group-info-modal.tsx`

- Conversation header overflow grouping (disclosure doc Finding 6) — fixes §12.
- `group-info-modal.tsx` Leave/Delete spacing (`:516`, `pt-4` is *less* than the `space-y-6` used everywhere else) — widen this specifically so the destructive action gets the visual separation the rest of the file already implies it deserves (the file already does §5 right everywhere else; this one spot regressed it). Fixes §5 and reinforces the existing §12 finding in one edit.
- Unpaired dark-mode colors: `swipeable-convo-row.tsx:122,153`, `messaging.tsx:108`, `group-info-modal.tsx:473` — batch these while in the files for the above.

---

## Files confirmed clean, no further work needed

`task-manager.tsx`, `locations-manager.tsx`, `arl-calendar.tsx` (layout/hierarchy — has a real §8 finding below), `emergency-broadcast.tsx` (the one file in the whole console that already builds hierarchy from weight+color+position together — use it as the in-house reference example when fixing the others), `forms-repository.tsx`, `remote-viewer.tsx`/`remote-management.tsx`, `broadcast-launcher.tsx`/`broadcast-studio.tsx` (functionally simple enough that there's nothing to over-engineer here — gradients are a separate, already-logged finding, not a §4/5/7 issue).

## App-wide pattern to fix once, not per-file

**The opacity-based dark-mode pattern (`bg-*-500/10` + `dark:bg-*-500/20` or `dark:text-*-400`) is already this codebase's correct convention** — `analytics-dashboard.tsx`, `meeting-analytics.tsx`, `remote-viewer.tsx`, `forms-repository.tsx`, and `emergency-broadcast.tsx`'s opacity-based cards all use it correctly. The flat `bg-*-50`/`bg-*-100` swatch-with-no-dark-pair is the actual offender, and it recurs across `data-management.tsx`, `arl-calendar.tsx`'s task-type pills, `arl-sidebar.tsx`, `user-management.tsx`, `swipeable-convo-row.tsx`, `messaging.tsx`, and `group-info-modal.tsx` — same fix (swap to the opacity-based pattern, or add the missing `dark:` pair) everywhere it shows up. Worth a single grep-and-fix sweep (`bg-(red|amber|emerald|purple|sky|blue|indigo|cyan|yellow|orange)-(50|100)\b` without a same-line `dark:` pair) rather than fixing it file-by-file as each gets touched for other reasons — but it's compatible with the per-file plan above; whichever happens first, the other doesn't need to re-check it.

Checked and ruled out: one of this pass's sub-agents flagged `--hub-red` (`globals.css:98` light `#e4002b` → `:145` dark `#ef4444`) as going *more* saturated in dark mode. Recomputed by hand: `#e4002b` is HSL ~100% saturation, `#ef4444` is ~84% — dark mode is actually slightly *less* saturated and lighter, which is the right direction per Section 8. Not a finding; verifying it before writing it down here saved a wrong line item.

## Recommended sequencing

1. ~~**Sidebar grouping** (`arl-sidebar.tsx`)~~ — **done.** Grouped into Operations/Administration, then reordered both clusters by actual frequency/importance (Emergency Broadcast deliberately out of frequency order, given its safety-critical nature).
2. ~~**Data Management**~~ — **done.** Collapsed the 21-card, 7-section, 11-color wall into two severity tiers: a "safe/routine" tier (Maintenance, Sessions, Archive, Reports, Backup & Export — 11 cards, visible by default, neutral chip/border/button) and a "destructive/irreversible" tier (Conversations & Broadcasts, Task Completion Data, System — 10 cards, collapsed behind a dashed-border "Show Destructive & Irreversible Operations" toggle, red chip/border/button). Reclassified several cards by actual risk rather than their old arbitrary color (e.g. `force-all`/drop-tables moved to destructive despite not being a "purge" card; `archive-*`/session-clearing stayed safe since they're reversible or ephemeral). Verified in both light and dark mode via Playwright against a temporary isolated route (local dev DB has the same pre-existing `grid_layout` schema drift noted in the sidebar commit, blocking real login).
3. ~~**Overview** + **Meetings tab split**~~ — **done.** Merged TickerPush + LiveActivityFeed into one "Live Feed" card (removed the "🟢 Live" label); deleted the duplicate 7-day trend chart, replaced with a "View full analytics" link to `/arl/analytics`; KPI cards now get a `border-2` weight tier when they represent a real problem (overdue > 0, completion < 50%), not just a different hue — verified the border dynamically follows whichever card is actually bad, not a fixed one; scoped the global task-completion toast to `displayView !== "overview"` in `arl/layout.tsx`. Meetings split into Meetings/Analytics tabs (`Tabs` from `@/components/ui/tabs`) so visiting to join/schedule a meeting no longer scrolls past a full analytics dashboard. Verified all of it in a real browser via temporary isolated routes with mocked API responses.
4. ~~**Tenant Settings** disclosure + spacing.~~ — **done.** Split 4 flat sections (Plan/Branding/Timezone/Domain&Assets) into 3 tabs grouped by edit cadence: **Branding** (default — Plan info read-only card for context, then editable identity+color fields), **Domain & Assets** (Hub URL + Custom Domain tight-proximity group, then `mt-8` gap before Logo/Favicon grid — different category), **Timezone** (isolated; changed least often). Spacing within each tab now varies deliberately: identity fields share a tight `grid-cols-2` gap-4, Brand Color gets `mt-6` before it (different interaction type from text fields), Live Preview gets `mt-4` (directly mirrors the color, close relationship). Icon chips updated from flat `bg-*-100 dark:bg-*-900/30` to the opacity-based `bg-*-500/10 dark:bg-*-500/20` pattern already used correctly by analytics/meeting-analytics/emergency-broadcast. Verified with Playwright via temporary isolated route (same dev-DB schema-drift restriction as prior commits — mock data injected at the verify page level).
5. ~~**Task form modal** layout grid + selected-state fix (two principles, one diff).~~ — **done.** Type + Priority moved into a 2-column grid (`grid-cols-2 gap-4`) — both answer "what kind of task is this" so they belong side-by-side, not separated by the same gap as unrelated groups (§4). All five button-group selectors (Type, Priority, RecurringType, AssignMode, Location multiple-select) changed from tint-only selected state (`bg-[var(--hub-red)]/10 text-[var(--hub-red)]`) to solid fill (`bg-[var(--hub-red)] text-white`), matching the day-of-week and biweekly-start pickers that already used filled correctly — a real shape change, not just a color change (§7). Spacing varied deliberately: Title+Description share a tight `space-y-3` group (same field type); `mt-4` between Type+Priority and Date/Time; `mt-6` before Recurring (qualitatively different concern: scheduling vs. task definition) and before Location Assignment (who has this task, distinct from when/how often). Amber warning text `text-amber-600` paired with `dark:text-amber-400` (§8). Verified with Playwright — 2-col grid confirmed (Type x≈408, Priority x≈648, same row).
6. ~~**User Management** row-action overflow + permissions modal grid.~~ — **done.** Row actions collapsed from 4 equal-weight icons to 3: Edit (frequent) + Toggle Active (moderate) stay visible; Permissions (rare, admin-only) and Delete (destructive) move into a `MoreVertical` overflow dropdown — fewer icons competing for the same visual tier (§7). Permissions modal: role-template selected state changed from tint to solid fill (consistent with task-form-modal changes in the same pass); location assignment toggle size unified to `h-5/w-9` + `h-4/w-4` to match the per-group permission toggles that appear directly below (they were `h-4/w-7` + `h-3/w-3`, visually inconsistent with the same component type immediately below — §4 layout drift); the three structural sections (Role Template, Location, Permission Groups) split into two indented groups with `mt-6` before Permission Groups so there's a clear visual tier between "configure who this person is" and "what they can do" (§5 spacing). Error banner in create/edit modal gets `dark:bg-red-950/30 border border-red-200 dark:border-red-800 dark:text-red-400` (§8 — same pattern already present in tenant-settings). Verified with Playwright: 3 row buttons confirmed, overflow opens with both items.
7. ~~**Messages** header overflow + group-info spacing fix.~~ — **done.** Direct/Group new-chat buttons re-tiered: Direct is now primary/filled (`bg-[var(--hub-red)] text-white`), Group stays secondary/muted — starting a DM is far more frequent than creating a group, the identical visual weight was the §12 violation flagged in the logged-but-not-yet-scheduled section. Chat header refactored: Group Info + Search folded into a single `MoreVertical` overflow (4-5 equal-weight actions → 2 visible + overflow); Back and Mute stay visible since Back is used every visit and Mute's active state is useful to see persistently without opening a menu. `group-info-modal.tsx` Leave Group spacing: `pt-4` → `pt-6` to match the `space-y-6` used throughout the rest of the modal, giving the destructive action the visual separation it had implicitly earned (§5). Dark-mode pairs: `messaging.tsx` member-select highlight `bg-red-50` → `bg-[var(--hub-red)]/10` (opacity-based, dark-safe); `swipeable-convo-row.tsx` unread background `bg-red-50` → `bg-[var(--hub-red)]/10` and delete-hover `bg-red-50` → `bg-red-500/10 dark:bg-red-500/10`; `group-info-modal.tsx` Creator badge `bg-amber-500` → `bg-amber-500 dark:bg-amber-600`. Verified with Playwright: Direct primary class confirmed, Group secondary confirmed, overflow shows Group Info + Search.
8. **App-wide dark-mode swatch sweep** — whenever convenient, independent of the above sequence.

## Logged for follow-up — found during implementation, not yet scheduled

Two issues surfaced from direct user testing while working through this
plan, outside its original scope (notification volume/architecture,
broadcast video). Decided to finish this plan in order first and treat
these as their own follow-up pass — recording findings now so they aren't
lost.

### Notification system generates volume disproportionate to what's earned (Section 18)

Confirmed: `task_completed` alone fans out via `createNotificationBulk`
to every active ARL on every task completion at every location
(`src/app/api/tasks/complete/route.ts:83-99`) — 100-750+/day for a
20-50-location org, before counting `location_online`/`location_offline`
(`src/lib/socket-server.ts:159-171, 340-349`, fires on every socket
connect/disconnect) or `task_overdue_location`
(`src/lib/task-notification-scheduler.ts:128-140`). One `task:completed`
event currently produces a push, a DB notification row, a toast
(`arl-dashboard-context.tsx:358-371`), *and* a Live Activity Feed entry
simultaneously — the exact pattern Section 18 names.

**Independent bug, regardless of redesign direction**: push sends
(`src/lib/push.ts`'s `sendPushToAllARLs`/`sendPushToARL`) never check
`isNotificationAllowed()` — only in-app notification creation does
(`src/lib/notifications.ts:80-113`). An ARL who disables a notification
type in `notification-settings-panel.tsx` still gets pushed to their
phone for it. `task_overdue_location` has no toggle in that panel at all.

**Decided direction (sharper than the original "gate push by
preference" framing): remove the notification bell/panel from desktop
chrome entirely, not just push.** A bell's only job is surfacing things
you'd otherwise miss because you're not currently looking at the app —
on a desktop ARL session that premise never holds; whatever it would
tell you is already visible by being in the app (the merged Live Feed,
the relevant page). The bell only earns its place where the premise is
real: a phone, PWA-installed, where the point of push is specifically
*not* having the app open. This is Section 18's test applied to the
whole feature rather than one element: it's the genre-default trap (a
dashboard "needs" a bell because dashboards have one) rather than
something desktop usage actually lacks.

Precondition before implementing — every notification type needs either
a desktop-visible equivalent, or promotion to a toast (cross-page,
time-sensitive, doesn't wait for someone to land on the right page):

| Type | Desktop equivalent already visible? | Verdict |
|---|---|---|
| `task_completed` | Yes, once the Overview merge (next section) ships — the Live Feed | Bell unnecessary; push becomes mobile-only |
| `location_online`/`location_offline` | Partially — current status shows on Locations/Overview, but no *history* of blips | The merged Live Feed needs to log these too, or it's a real gap, not just a removed bell |
| `task_overdue_location` | Partially — Overview's "Tasks Overdue" KPI shows a count, not which location/task | Borderline — likely needs **promotion to a toast** (actionable, time-sensitive), not a panel entry |
| `meeting_joined` (host-only) | Yes — visible live in the meeting UI itself while hosting | Bell unnecessary, it's already in-context |
| Guest waiting to join (`socket-server.ts:195`, distinct from the above) | No — nothing else surfaces "X is waiting" | Needs a **toast**, not a panel entry and not push-gating — no other surface shows this at all |
| `analytics_alert`, `system_update` (`notifications.ts:19-26`) | Type exists in the schema; no confirmed trigger call site found anywhere | Likely unused/reserved — confirm before designing around it, don't assume it's live |

Settings/preferences page stays — reframed as "what gets pushed to your
phone" rather than "what shows in your bell," configurable from either
device. `NotificationBell`/`NotificationPanel` come out of
`arl/layout.tsx`'s header on desktop via the same `isMobileOrTablet`
branch point already used for `SettingsPanel`/`PageIndicator` — deleted
for that branch, not conditionally hidden.

### Go Live broadcast — two confirmed bugs, one architecture question

1. **Mic/camera prompt for passive location viewers.**
   `MeetingRoomLiveKitCustom` calls `getUserMedia({ audio: true, ... })`
   unconditionally on mount for every participant — no viewer-only mode
   exists. The LiveKit token endpoint
   (`src/app/api/livekit/token/route.ts:51-57`) issues identical
   `canPublish: true` grants to hosts and viewers alike, so a location is
   a full two-way publishing peer at the protocol level regardless of UI.
2. **Navbar visually overlaps the meeting video — "Go Live" path only.**
   `BroadcastStudio` ("Start Meeting") correctly hides the ARL shell via
   `activeView === "broadcast"` (`arl/layout.tsx:102,112,131`).
   `BroadcastLauncher` ("Go Live") never goes through that gate — it's a
   plain in-page modal rendering `MeetingRoom` directly. The ARL header
   is `z-[100]`; `MeetingRoom`'s root wrapper is `z-50`
   (`meeting-room-livekit-custom.tsx:150`) — lower z-index loses, so the
   header renders on top of the video wherever they overlap.
3. **Architecture question, user-raised**: should one-way broadcast reuse
   the full two-way conferencing component at all? The mic-prompt bug is
   a direct symptom of that reuse — there's no "pure viewer" concept
   anywhere in the stack. A real fix is a dedicated, stripped-down viewer
   component for locations (no `getUserMedia`, `canPublish: false`,
   subscribe-only) — a genuine feature change, not a quick patch.

### Cards-as-fake-tables — a real, repeated pattern, not over-criticism

Direct question: is "everything in ARL is cards, even when the data is
tabular" actual AI-slop or just this product's house style? Ran a focused
pass across every list/grid surface in ARL against Section 11's "many
same-shaped records a user wants to scan/compare" test. Verdict: **real,
and consistent** — six surfaces independently show the same tell (each
row wrapped in its own `rounded-2xl border bg-card p-4`-style container
instead of tight, column-aligned rows), which is exactly what happens
when a list gets built without ever asking "what shape does this data
actually want."

**Should become real tables:**
- ~~`locations-manager.tsx:183-193`~~ — **done.** Real `<table>` on
  `md:` and up (Location/Status+last-seen/Address/Email/User ID/Actions
  columns), stacked-card fallback below `md:` mirroring the
  desktop-table/mobile-card pattern `meeting-analytics.tsx` already
  established for participants. PIN-reset inline form now expands as a
  `colSpan`-ed row beneath the location instead of inside the card. The
  "no Add Location entry point" flow gap noted alongside this finding
  was *not* fixed — out of scope for a shape change, logged here so it
  isn't lost.
- `user-management.tsx:326-409` — 7 fields per row, each its own card
  (`:342-345`), ID/store/email string-mashed into one free-text line
  instead of columns.
- `task-virtual-list.tsx:56` — same per-row card chrome; title, priority,
  type, due date/time, points, location all in one unaligned blob.
- ~~`forms-repository.tsx:272`~~ — **done.** Real `<table>` on `md:` and up (Form/File/Size/Uploaded/Actions columns); stacked-card fallback on mobile preserves the existing animated rows.
- `scheduled-meetings.tsx:417-420` — host/date/time/code metadata wraps
  instead of aligning; same-shaped, comparable records.
- ~~`data-management-audit-log.tsx:79-80`~~ — **done.** Real `<table>` on `md:` and up (Actor / Action / Details / When / IP columns, sticky `<thead>`, scrolls within `max-h-96`); stacked-card fallback on mobile. Extracted `filteredLogs` variable to drive both views from one filter computation. Updated actor-type badge from flat `bg-purple-100 dark:bg-purple-950` to opacity-based `bg-purple-500/10`.
- `meeting-analytics.tsx`'s "Recent Meetings" list (`:411-444`) — same
  tell, and notably **inconsistent with itself**: this exact file's
  participant detail view (`:193-245`) already correctly uses a real
  `<table>` with a mobile-card fallback. The pattern already exists in
  this codebase; it just wasn't applied to the list above it.

**Confirmed correctly cards (control cases, not candidates):**
`remote-viewer.tsx`'s location grid (action launchers, not comparable
fields), `tenant-settings.tsx` (heterogeneous settings sections),
`messaging.tsx`/`swipeable-convo-row.tsx` (variable-length threads, not
tabular), `data-management.tsx` (independent maintenance tools — the
file's own restructuring this session already validated this),
`notification-settings-panel.tsx` (toggles, not sortable records),
`broadcast-launcher.tsx`/`broadcast-studio.tsx` (single-purpose forms).
`analytics-dashboard.tsx`'s "Task Performance" is **already a real
`<table>`** (`:362-379`) — prior audit's "fake table" concern is
resolved, no action needed there.

**Sequencing**: fix Locations first (highest-value, no flow-gap-free
alternative exists today), then the rest in roughly the order listed
above — Users and the Audit Log next (clearest violations), Tasks/Forms/
Scheduled Meetings after, Recent Meetings last (smallest list, lowest
urgency, but should copy the table+mobile-card pattern its own file
already has for participants rather than reinventing one).

### Action-button weight — ran the focused pass, mostly clean

Checked every route's PAGE-LEVEL header actions (not per-row actions,
audited separately) for Section 12 equal-weight violations. Result: this
was already in reasonably good shape — most routes have a single
obvious primary action or two genuinely-comparable ones. Two findings:

- **`messaging.tsx:204-220`** — real violation. "Direct" and "Group" new-
  chat buttons are identical neutral `bg-muted` pills, same size/weight,
  despite starting a DM being far more frequent than creating a group.
  Direct should be primary/filled; Group demoted to secondary.
- **`meetings/page.tsx:253-271`** — soft/minor miss. "Start Meeting" and
  "Schedule Meeting" sit at near-equal weight despite differing
  frequency (ad hoc vs. planned setup). Not flagrant; lower priority
  than the Messages fix.

Everywhere else checked (Tasks, Forms, Data Management, Tenant Settings,
Analytics, Notification Settings, Audit Log, Emergency Broadcast,
Broadcast Launcher/Studio, Remote) — confirmed fine, no tiering issue.

### Overview as a true single-viewport dashboard — bigger than a file fix, logged for its own decision

Direct feedback: Overview should be a real "look once, no scrolling"
dashboard — at-a-glance only — not just the 3 KPI cards but the whole
page (Location Performance + Live Feed included). Honest assessment:
this is a good goal, but it's a structurally different ask than the
merge/dedup work just done. `LiveActivityFeed` already bounds its own
list height (`max-h-[300px] overflow-y-auto`), which is the right
*mechanism* — the actual blocker is that Overview stacks full-width
sections vertically with no shared height budget, so KPIs + Location
Performance + Live Feed accumulate past one viewport regardless of any
one section's internal scrolling. Making the whole page fit one
viewport for real means giving it a fixed-height grid with each section
owning an allocated region (closer to what the kiosk dashboard's grid
system already does) rather than a stack of cards that each grow to fit
their content. That's a real layout decision, not a tweak — logged here
rather than folded into the current pass silently.
