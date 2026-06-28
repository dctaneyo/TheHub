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

1. **Sidebar grouping** (`arl-sidebar.tsx`) — cheapest, reframes the whole console.
2. **Data Management** — highest combined risk + principle count; the table above shows why this is the one file where "audit everything first" most clearly pays off.
3. **Overview** (merge Ticker/Activity into one Live Feed, delete the duplicate trend chart, fix KPI hierarchy, scope the toast) + **Meetings tab split** — same "this page is doing too many jobs" shape, do together.
4. **Tenant Settings** disclosure + spacing.
5. **Task form modal** layout grid + selected-state fix (two principles, one diff).
6. **User Management** row-action overflow + permissions modal grid.
7. **Messages** header overflow + group-info spacing fix.
8. **App-wide dark-mode swatch sweep** — whenever convenient, independent of the above sequence.
