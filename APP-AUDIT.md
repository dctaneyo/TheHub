# Project-Wide Design Audit — 2026-06-28

Audit of everything **outside** the already-redesigned `/dashboard` and `/arl`
surfaces, against [DESIGN.md](DESIGN.md), using `npm run design:scan` plus
manual review. No code changes were made as part of this audit — findings
only. This is the third audit in the series after
[DASHBOARD-AUDIT.md](DASHBOARD-AUDIT.md) and [ARL-AUDIT.md](ARL-AUDIT.md), and
follows the same method: cite file:line evidence, separate deliberate
variation from accidental drift, and call out scanner false positives
explicitly.

The headline is the same shape as the prior two: the **mechanical
codebase-wide retrofits** (weight scale → `font-semibold` only, font floor,
8pt spacing) already reached every file here — but the **per-surface
interaction passes** the dashboard and ARL got (hover→active, IconTip,
color-token compliance, StatusDot/EmptyState adoption, the flat-elevation
pass) never ran on these surfaces. They are roughly where `/dashboard` was
before its redesign — except this time the worst offender is a **shared
primitive (`ui/button.tsx`)** that propagates one violation into eight files
at once.

## Scope

Everything not covered by the two prior audits:

- **`src/app/` routes:** `login`, `signup`, `tasks`, `messages`, `calendar`,
  `admin`, `meeting` (+`meeting/layout`), root `page.tsx` (→ landing),
  `layout.tsx`.
- **`src/components/` shared (non-arl/non-dashboard):** `meeting-room/*` (7
  files) + `meeting-room-livekit-custom.tsx`, `landing-page`,
  `confirm-dialog`, `connection-status`, `global-search`,
  `notification-bell`, `notification-panel`, `voice-recorder`,
  `mention-input`, `emoji-quick-replies`, `live-activity-feed`,
  `app-header`, `theme-toggle`, `offline-indicator`, `animated-background`,
  `error-boundary`, `remote/*`, `keyboard/onscreen-keyboard`, `build-badge`,
  `csrf-init`, `inactivity-warning`.
- **`src/components/ui/`** — the shared primitive library, checked against
  DESIGN.md's documented decisions.

**Out of scope (verified, stated as exceptions, not findings):**
- `src/app/design-preview/page.tsx` + `preview.css` — this is the
  `/design-preview` prototype reference surface DESIGN.md §2/§15 cite
  directly. It imports `@phosphor-icons/react` directly (a §14 violation
  *everywhere else*) precisely because it is the reference mock-up, not
  production. Excluded from all counts below.
- `/login` and `/dashboard/page.tsx` were already audited+fixed (login
  verified clean below); `/tasks`, `/messages`, `/calendar`, `app-header.tsx`
  are the recently-built routes that already shipped to kiosk conventions
  (verified hover-clean below).

## Scanner summary (scoped to in-scope files)

The repo-wide scan reported 422 findings / vibe 901. Triaged to in-scope
surfaces:

| Rule | In-scope assessment |
|---|---|
| `ai-purple` (41 repo-wide) | **Mostly false positives / categorical.** Real arbitrary uses: `signup/page.tsx:258` (purple icon chip for the Branding step — see Finding 4), `meeting-room/controls-bar.tsx:117` (purple "raise hand"/reaction button — arbitrary). Categorical-but-undocumented (legitimate use, drift only in that it's off the claimed table): `global-search.tsx:26`, `mention-input.tsx:140` (form/group type), `meeting-room/transfer-dialog.tsx:46` (guest user-type). False positives: `signup/page.tsx:293` (a brand-color *picker* offering `#7c3aed` as a tenant choice — the app isn't defaulting to it), `globals.css:92,110` (`--chart-5`/`--hub-purple` tokens — defined, used categorically). |
| `claude-default-look` (16 repo-wide) | **All false positives.** Every cited in-scope line is semantic amber/orange/emerald (priority/status), not the cream-bg+serif tell. Confirmed: `arl/messaging.tsx:274`, `arl/analytics-dashboard.tsx:43`, `arl/overview-dashboard.tsx:170`, `arl/locations-manager.tsx:170,208` are all `bg-amber-*`/`bg-orange-*`/`bg-emerald-*` priority/completion-rate semantics — legitimate per Section 2's claimed-color table, already accounted for in ARL-AUDIT.md, **not new drift.** No serif font, no cream background anywhere in the app. |
| `rounded-everything` (205 repo-wide) | **Real — same conclusion as both prior audits.** In-scope radius distribution: `rounded-full` 223, `rounded-xl` 243, `rounded-lg` 186, `rounded-2xl` 131, `rounded-md` 33, `rounded-3xl` 12, `rounded-sm` 1 — six scales in active use with no documented container/control/circle logic. See Finding 7. |
| `fade-in-animations` (95 repo-wide) | **Mostly mount transitions (false positives), one real hit.** The `meeting/page.tsx` cluster the scanner flagged as "missing `initial` prop" all *have* `initial` props (542/612/672/721/779/804 verified) — these are deliberate step-transition mount animations, not boilerplate. The one real boilerplate-animation hit is `meeting-room-livekit-custom.tsx:1414` `hover:scale-125` (Finding 2). |
| `emoji-as-icons` (64 repo-wide) | **Almost all false positives (emoji-as-data), two real-ish.** False positives: all `api/**/route.ts` console/notification *text*, `emoji-quick-replies.tsx` (deliberate emoji-reaction feature), `onscreen-keyboard.tsx` emoji-picker grid, `meeting-room/types.ts` `REACTION_EMOJIS`, `ticker` icon-picker data. Real UI-icon uses: `live-activity-feed.tsx:56,69` (`✅`/`💬` as activity-type icons in a feed that *also* has a real `getIcon()` returning Phosphor icons — the emoji field is redundant/unused-looking, Finding 9), and `remote/mirror-toolbar.tsx:175` (`📱`/`🖥️` as device-type indicators — minor). |
| `hero-three-cards` (1 repo-wide) | **False positive** as cited (`scheduled-meetings.tsx:307`, a meeting-list grid). But see Finding 8 — `landing-page.tsx` *does* have a centered-hero-then-feature-grid, just with 4 columns not 3, so the scanner's regex missed the real one and fired on a non-instance. |

**The scanner has no rule for the two highest-value findings** (hover-only
feedback, `title`-only icon tooltips) — both product-specific, found by
manual review (Findings 1 and 3), exactly as in the two prior audits.

## Genuine findings

### 1. Hover-only feedback — the largest finding, scanner-invisible, and it starts in a shared primitive

DESIGN.md Section 6 / Do Not Use: this is a touchscreen kiosk product with no
pointer; hover-only feedback is invisible to real users and risks the "stuck
hover" bug. Neither login (0 hover / 11 active), `/tasks` (0/3), `/messages`
(0/1), nor `app-header.tsx` (0/5) have this problem — they were built to
convention. Every *other* in-scope surface still has it, **~110+ `hover:`
instances across ~20 files**, none paired with `active:`.

**The root cause is `src/components/ui/button.tsx`.** Every variant defines
feedback *only* on hover with no `active:` — `default: hover:bg-primary/90`,
`destructive: hover:bg-destructive/90`, `outline/secondary/ghost/link` all
the same (`button.tsx:12-21`). Eight in-scope files render `<Button>`, so
fixing this one primitive fixes the press-state for all of them at once.
`ui/badge.tsx:12-20` has the same `[a&]:hover:` pattern for its linkable
variant.

Per-file hover counts (all confirmed hover-*only*, no `active:` pairing):

| File | `hover:` count | Notes |
|---|---|---|
| `meeting-room/controls-bar.tsx` | 13 | every mic/cam/screen/hand/leave button (47/48/62/63/78/79/93/94/105/117/125/133/143) |
| `meeting-room-livekit-custom.tsx` | 12 | join/leave/toolbar buttons (434/435/449/450/463/469/1018/1059/1121/1138/1155) + `hover:scale-125` (Finding 2) |
| `admin/page.tsx` | 11 | every row action + form buttons (258/285/292/333/371/378/386/420/498/551/557) |
| `notification-panel.tsx` | 9 | incl. two hover-*reveal* opacity toggles (Finding 1a) |
| `meeting-room/participant-panel.tsx` | 9 | row actions (pairs `active:` on 3, color-shifts on hover only on the rest) |
| `voice-recorder.tsx` | 7 | every transport button (125/140/143/155/162/165) |
| `landing-page.tsx` | 7 | marketing page — lower priority (Finding 8) |
| `meeting/page.tsx` | 7 | back/join buttons (596 etc.) |
| `signup/page.tsx` | 6 | nav + step buttons |
| `confirm-dialog.tsx` | 5 | the shared confirm dialog's buttons (22/26/30 variant maps + close + cancel, 94/104) — propagates everywhere `useConfirmDialog` is used |
| `global-search.tsx` | 4 | |
| `meeting-room/qa-panel.tsx` / `chat-panel.tsx` / `transfer-dialog.tsx` / `rename-dialog.tsx` / `zoomable-video.tsx` | 2–4 each | |
| `notification-bell.tsx` | 2 | (0 active) |
| `live-activity-feed.tsx` / `mention-input.tsx` / `emoji-quick-replies.tsx` / `error-boundary.tsx` | 1–2 each | |

**Finding 1a — hover-*reveal* (worse than a hover color shift):**
`notification-panel.tsx:150` and `:357` use `opacity-0 group-hover:opacity-100`
to reveal the per-item dismiss/clear buttons. On a kiosk with no pointer
these controls are **permanently invisible** — not just unstyled,
unreachable. This is the same disclosure-via-hover mechanism DESIGN.md §12
says must be a deliberate tap instead. Same pattern, lower volume:
`meeting-room-livekit-custom.tsx:1059` (`hover:bg-white/20` on a notification
dismiss).

This is the single highest-value, lowest-risk fix available, and the
cheapest of all is the `Button`/`Badge`/`ConfirmDialog` primitive trio.

### 2. Boilerplate hover-grow animation — a literal Do Not Use entry

`meeting-room-livekit-custom.tsx:1414` — the emoji-reaction button uses
`text-lg hover:scale-125 transition-transform p-1 hover:bg-white/10
rounded-full`. "Scale-up-on-hover" is named verbatim in the Do Not Use list
as boilerplate animation with no communicative purpose, and it's hover-only
(invisible on kiosk anyway). Drop the scale; if a press flourish is wanted,
use `active:scale-`.

### 3. Zero IconTip adoption outside the three primitives that bake it in — icon-only controls rely on `title=`

`IconTip` (the touch-compatible tooltip, DESIGN.md §13) is imported by only
three files in scope, and all three are the *primitives that wrap it
internally* (`app-header.tsx`, `ui/destructive-icon-button.tsx`,
`ui/modal-close-button.tsx`). Every hand-rolled icon-only control elsewhere
falls back to the hover-triggered native `title` attribute, which is
functionally invisible on touch:

- `notification-panel.tsx` — 151 (Dismiss), 281 (Dismiss all), 289 (Notification Settings)
- `voice-recorder.tsx` — 126 (Record), 140 (Stop), 143 (Cancel), 156 (Play/Pause), 162 (Delete), 165 (Send) — six unlabeled transport controls
- `live-activity-feed.tsx:132` (Clear all activity)
- `admin/page.tsx` — 372 (Visit tenant), 379 (Edit), 387 (Delete)
- `meeting-room/participant-panel.tsx` — 63/70/77 (mute/unmute/lower-all), 118 (Rename), 128 (Lower hand)
- `meeting-room/chat-panel.tsx:75` (Onscreen keyboard), `meeting-room/zoomable-video.tsx:179` (Reset zoom)
- `meeting-room-livekit-custom.tsx` — 1122 (Participants), 1141 (Chat), 1158 (Q&A) — the main control bar toggles
- `login/page.tsx` — 739 (keyboard toggle), 1057/1072 (session-signal/refresh) — note these coexist with a redundant visible label in some cases; `title` still adds nothing on touch

`admin/page.tsx:271` (`title={missed ? ...}` in `/tasks`) is a non-finding —
it's a status `<span>`, not an interactive control.

### 4. Arbitrary purple in two spots; categorical-but-undocumented purple in three more

Section 2: every color has a stated job; the claimed table is red / amber /
emerald / teal. Purple/indigo isn't on it, and the Do Not Use list bans
purple as a default accent.

**Arbitrary (no semantic job) — real findings:**
- `signup/page.tsx:258` — the "Brand Your Hub" step's icon chip is
  `bg-purple-600` while the sibling "Organization" step chip (line 202) is
  `bg-red-600`. Purple here means nothing; it's per-step decoration. Use
  brand red or a neutral.
- `meeting-room/controls-bar.tsx:117` — the raise-hand/reaction button is
  `bg-purple-600 hover:bg-purple-700`. No stated reason this action is
  purple; every other control in the bar is slate/red/blue/green/yellow
  already (see Finding 5).

**Categorical-but-off-the-table (legitimate use, documentation drift — same
conclusion the dashboard audit reached for `restaurant-chat`):**
- `global-search.tsx:26` — `form` type = purple, in a real categorical map
  (task=green, message=blue, form=purple, location=orange).
- `mention-input.tsx:140` — `group` mention = purple vs location = emerald.
- `meeting-room/transfer-dialog.tsx:46` — guest user-type = purple vs
  arl = blue vs slate.

These three are the same legitimate categorical pattern the dashboard audit
flagged for documentation, not removal — but note that two of them
(`global-search`, `mention-input`) use Tailwind `purple-*` directly, the
exact hue the Do Not Use list calls out, where a non-banned categorical hue
would carry the same information without tripping the rule.

### 5. The meeting-room feature runs entirely on raw Tailwind `slate`/`blue`/`green`/`yellow`/`white/N`, not the app's tokens

This is the in-scope equivalent of ARL's indigo-remote-view finding (Finding
3 there): a whole feature surface built before the token system and never
migrated. `meeting-room-livekit-custom.tsx` alone has 66 `slate-*`, 16
`red-*`, 9 `green-*`, 4 `blue-*`; `controls-bar.tsx` has 14 `slate-*`;
`admin/page.tsx` has 34 `slate-*` + 39 `white/N`. Specific drift:

- **Inconsistent semantic color within one component:** `voice-recorder.tsx`
  uses red for the *recording* state (137-145, correct — matches
  `--hub-red`/destructive) but `blue` for the *recorded/playback* state
  (152-165) and `green` for Send (165). Blue and green here are arbitrary
  mode-coloring, not from the claimed table; the Delete button is
  `text-blue-400 hover:text-red-500` (mixed-signal). `VoiceMessagePlayer`
  (199-209) is entirely `blue`.
- **`admin/page.tsx`** is a dark-only surface hand-built on `bg-slate-900`
  gradients + `bg-white/5`/`border-white/10` (217/226/271/333 etc.) rather
  than the `bg-card`/`bg-muted`/`border-border` tokens that make every other
  surface dark-mode-aware through one system. It's internally consistent but
  it's a parallel color system.
- **`confirm-dialog.tsx`** variant map (19-32) uses raw `red`/`amber`/`slate`
  where the rest of the app (and login, per the Changelog) moved its
  dialogs to `--destructive`/semantic tokens. Since this is the shared
  confirm dialog, the raw colors propagate to every consumer.

### 6. Decorative gradients against the flat house style

Section 3 makes elevation flat fill-contrast; Behavior Rules require stating
what a gradient communicates.
- **`meeting/page.tsx`** — four per-step card headers use
  `bg-gradient-to-r from-X to-X` (548 amber, 618 blue, 678 slate, 727 red).
  These are mono-hue (so *not* the purple-blue tell) and roughly map to step
  semantics, but they're decorative against the flat direction, and the
  `from-slate-700 to-slate-800` one (678) carries no semantic meaning at all.
- **`signup/page.tsx:163`**, **`admin/page.tsx:217/226/271`**,
  **`meeting/page.tsx:532/973`**, **`error-boundary.tsx:61`** — full-page
  `bg-gradient-to-br from-slate-900...` backgrounds. Decorative ambient
  gradients.
- **`emoji-quick-replies.tsx:30`** — stacks
  `bg-gradient-to-r from-slate-50 to-slate-100` + `border` + `shadow-sm` +
  `hover:shadow` + hover-only color shift on one pill — the exact "stacking
  more than one decorative effect with no reason for each" Do Not Use entry,
  plus hover-only feedback.
- **`landing-page.tsx:81`** — `bg-gradient-to-b from-slate-50 to-white` +
  `shadow-2xl shadow-slate-200/50` on the preview frame (marketing, lower
  priority).

### 7. Radius inconsistency — six scales, no stated logic (same as dashboard pre-redesign)

`rounded-xl` 243, `rounded-full` 223, `rounded-lg` 186, `rounded-2xl` 131,
`rounded-md` 33, `rounded-3xl` 12, `rounded-sm` 1 across in-scope files. This
is the Do Not Use "large rounding used inconsistently" case, not the
deliberate house style — the dashboard and login got a
container/control/circle pass, these surfaces never did. Notably the shared
primitives disagree with the house style: `ui/button.tsx` and `ui/card.tsx`
use `rounded-md`/`rounded-xl` while the app's containers (login card,
modals, `confirm-dialog`) use `rounded-2xl`/`rounded-3xl`. Needs the same
pass, lower severity than the interaction findings.

### 8. `landing-page.tsx` is the actual centered-hero-then-feature-card skeleton (the scanner missed it)

The scanner's `hero-three-cards` rule fired on a false positive and missed
the real instance because the grid is 4-up not 3-up: `landing-page.tsx:50`
(centered hero, `text-center`) directly above `:100`
(`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4` feature cards, `:102`
identical `rounded-2xl border shadow-sm` chrome on every card). This is the
single most recognizable layout tell named in Do Not Use.

**Mitigating context (why this is lower-priority, not a non-finding):** it's
a marketing/landing page, which DESIGN.md §0/§1 explicitly grant "more
expressive range" and exempt from the type scale (the `text-6xl font-black`
hero is allowed here). It uses real product feature-icons (not undraw
blobs), the copy avoids the banned clichés ("Transform/Supercharge/Unleash"
— none present), and it has a deliberate brand-red accent. So it's *not* the
pure AI-default skeleton — but the hero+uniform-feature-grid structure and
the all-raw-`slate` palette mean it would benefit from a deliberate
layout-intent pass (Section 0, Decision 4) rather than the genre-default
three/four-card grid. Flagging as a known structural tell to revisit, not a
mechanical fix.

### 9. Component drift — StatusDot / EmptyState extracted for ARL, zero adoption here

The shared `StatusDot` and `EmptyState` primitives were extracted during the
ARL pass (DESIGN.md Changelog, ARL Finding 8). **Neither is imported by any
in-scope file.** The same hand-rolled drift Section 15 names persists:

- **Status-dot size drift** (the exact `h-1.5`/`h-2`/`h-2.5` inconsistency
  Section 15 cites): `connection-status.tsx:217,295` (`h-1.5 w-1.5`),
  `meeting/page.tsx:579,638` and `remote/mirror-toolbar.tsx:113,156,163`
  (`h-2 w-2`), `voice-recorder.tsx:137` and
  `meeting-room-livekit-custom.tsx:1107,1144` (`h-2.5 w-2.5`) — all "the"
  status dot, each re-guessed. Should be `StatusDot`.
- **Hand-rolled empty state:** `live-activity-feed.tsx:108` builds a
  `border-2 border-dashed border-border ... <Activity icon> + title +
  subtext` empty state by hand — that is exactly the shape of the shared
  `EmptyState` (icon + title + subtext + dashed border).
- **Redundant icon+field:** `live-activity-feed.tsx:56,69` store an emoji
  `icon` (`✅`/`💬`) on each activity item, but the render path uses
  `getIcon()` (line 87) returning real Phosphor icons — the emoji field
  looks like dead/redundant data (a §17 "redundant elements" + emoji-as-icon
  smell). Worth confirming it's unused and removing it.

### 10. Numeric/code displays and off-scale type

- **`tabular-nums` on `--font-sans` instead of `font-mono`** (Section 1's
  "one safe font disguised with a CSS property"): `voice-recorder.tsx:138,160,208`
  (recording/playback timers), `tasks/page.tsx:187,249` (counts).
  `app-header.tsx:36` does this *right* (`font-mono ... tabular-nums` for
  the clock) — so the pattern is established and these are drift from it.
  `meeting/page.tsx:560` correctly uses `font-mono` for the countdown —
  good.
- **Off-scale type:** `admin/page.tsx:309,316,323` use `text-3xl
  font-semibold` for stat numbers — `text-3xl` isn't on the 4-size scale
  (Display is `text-2xl`); these are KPI numerals, which qualify for the
  `font-black`+`font-mono` numeral-display exception but are currently
  neither. `error-boundary.tsx:65` `text-3xl font-black` for a "!" glyph is
  within the safety-alert exception (fine). 15 `text-base`/`text-xl`
  off-scale instances remain in-scope (excluding the documented `<Input>`
  16px floor) — the same per-instance-judgment follow-up the Changelog
  scoped for the rest of the app, not yet applied here.

### 11. Minor / data-polish

- **`build-badge.tsx`, `csrf-init.tsx`, `inactivity-warning.tsx`,
  `animated-background.tsx`, `offline-indicator.tsx`, `theme-toggle.tsx`** —
  checked, clean or trivial; not findings.
- 8 fine-grained spacing violations (`gap-1.5`/`p-2.5`/etc.) remain in-scope
  — small residue of the codebase-wide spacing retrofit; mechanical, low
  priority.

## Non-findings worth noting

- **Icon barrel is clean** — zero direct `lucide-react`/`@phosphor-icons/react`
  imports in any production in-scope file; everything routes through
  `src/lib/icons.tsx`. The only direct Phosphor import is
  `design-preview/page.tsx`, the reference prototype (Section 14 ✓).
- **Weight scale reached everywhere** — zero `font-medium`/`font-bold` in
  scope; the `font-black` uses are all within the stated exception (brand
  monograms `H`, the error-boundary `!`, KPI numerals, marketing headlines).
- **Login is clean** — 0 `hover:`, 11 `active:`, confirming the Changelog's
  login pass; not re-litigated.
- **`/tasks`, `/messages`, `app-header.tsx` are hover-clean** (0 hover each)
  — the recently-built routes already ship to kiosk conventions, which is
  *why* the hover problem is concentrated in the older meeting/admin/signup/
  voice surfaces.
- **The ARL `claude-default-look` and semantic-amber scanner hits are all
  legitimate and already accounted for** — verified `messaging:274`,
  `analytics-dashboard:43`, `overview-dashboard:170`,
  `locations-manager:170,208` are priority/completion-rate semantics
  matching Section 2's table, not drift.
- **The `meeting/page.tsx` step animations are real mount transitions**, not
  boilerplate fade-in — they have `initial` props; the scanner's "missing
  initial" flag is a false positive.
- **Most emoji hits are emoji-as-data** (reaction features, emoji keyboard,
  ticker/notification text, console logs) — not emoji-as-UI-icon. Only
  `live-activity-feed.tsx:56,69` and `mirror-toolbar.tsx:175` are arguable,
  both minor.
- **No purple-blue gradients, no gradient-filled text, no neon glow, no
  cream/serif "tasteful default", no glassmorphism-for-its-own-sake**
  anywhere in scope.
- **`backdrop-blur` uses are structural** (modal scrims in `confirm-dialog`,
  sticky nav in `landing-page`) — not decorative, not flagged.

## Recommended order of attack

Mirror the prior two audits — mechanical, low-risk, high-reach sweeps first;
design decisions last:

1. **Fix the shared primitives first (Finding 1, 5):** add `active:` states
   to `ui/button.tsx` and `ui/badge.tsx`, and move `confirm-dialog.tsx`'s
   variant map to semantic tokens with `active:`. This one change reaches
   eight files + every `useConfirmDialog` consumer for near-zero risk — the
   highest leverage available.
2. **Hover→active sweep (Finding 1, 1a, 2)** on the remaining hand-rolled
   controls (meeting-room cluster, admin, signup, voice-recorder,
   notification-panel, global-search). Convert the two
   `group-hover:opacity` reveals in `notification-panel.tsx` to a deliberate
   tap (overflow/always-visible), and drop the `hover:scale-125`.
3. **IconTip pass (Finding 3)** — wrap the ~25 icon-only controls; many are
   the meeting-room control bar and voice-recorder transport, which are
   pure icons with no fallback label at all.
4. **Color-token migration (Finding 4, 5)** — port the meeting-room feature
   and `admin/page.tsx` off raw `slate`/`blue`/`green`/`white-N` onto the
   app tokens (the ARL indigo→teal migration is the template); kill the two
   arbitrary purples; document the categorical color map
   (global-search/mention/transfer) once, as the dashboard audit
   recommended.
5. **Adopt the shared StatusDot/EmptyState (Finding 9)** and remove the
   redundant `live-activity-feed` emoji field.
6. **Numeric-font + off-scale type drift (Finding 10)** — `font-mono` on
   the timers/counts; round `admin`'s `text-3xl` stats per the
   numeral-display exception.
7. **Design decisions, last:** the radius system (Finding 7) and a
   deliberate layout-intent pass on `landing-page.tsx` (Finding 8) — these
   need a real design pass per surface, not a find-and-replace.

Findings 1–5 are mechanical/low-risk and cover the bulk of the vibe-score
volume on these surfaces; 6–10 are scoped per-file; the radius and
landing-page items are the only ones that need a design decision rather
than a sweep.
