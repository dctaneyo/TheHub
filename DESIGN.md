# UI/UX Design Standard

This file states the principles every screen has to be checked against,
plus one canonical list of specific patterns that are banned because
they're the patterns that make a UI read as AI-generated. It does not
try to specify exact component styling — this project isn't a generic
SaaS site, so a generic component rulebook (exact button radius, exact
card shadow) would constrain decisions that haven't been made yet and
go stale the moment they are. Token values (palette, type, spacing
unit) get decided and recorded elsewhere as the actual design takes
shape; this file is the standard those decisions get checked against.

**Structure: one universal gate (Section 0), then two parts.** Part A
(UX) asks what the user is trying to do, what they need to know and
when, and whether something on screen is earning its place — before any
visual execution gets chosen. Part B (UI) governs how an already-answered
UX question gets expressed: type, color, spacing, layout, motion, icons,
and the specific patterns that read as generated rather than designed.
Neither part can rescue what the other gets wrong — a UI built before
its UX is decided defaults to "whatever a screen like this usually has"
(Section 0), and a correct UX with sloppy execution still reads as
unfinished (every section in Part B). **Section numbers are stable IDs**
— other docs in this repo (the ARL audits) cite them directly — so they
don't track physical reading order after this restructure. Section 18
sits in Part A despite the high number because it was added after 1-17
already existed; where it appears in the document, not what it's
numbered, is what changed.

A line can be marked `unslop-ignore` (trailing code comment) to mark a
deliberate, considered exception to the Do Not Use list below. That tag
means "we decided this on purpose," not "I don't want to deal with this
warning."

---

## 0. Four Decisions Before Any Screen Gets Built

An unspecified design brief defaults to whatever's statistically average
in the model's training data — which is exactly what reads as AI-made.
Before generating a new screen or component family, these four have to
be answered explicitly. None of them can be "modern and clean."

1. **Reference anchor** — one real product, site, or named direction
   this should resemble. Not a mood word.
2. **Color decision** — a specific, deliberately chosen color, not a
   framework default.
3. **Type decision** — a specific typeface chosen with a stated reason,
   not whatever the starter template shipped with.
4. **Layout intent** — what's the primary action on this specific
   screen, and does the structure serve that, rather than defaulting to
   a generic skeleton regardless of content.

If a request comes in with no brief, the answer is never "produce the
safest, most average-looking result." State a deliberate choice with a
one-line rationale, or present genuinely distinct options.

**Decision 4 (layout intent) is the bridge into Part A below** — it's
the first UX question this doc asks, before any of Part A's deeper ones
(Sections 11/12/13/16/18) get applied to the same screen.

---

## Part A — UX: Decide First

These sections ask what the user is trying to do, what they need to
know and when, and whether anything on screen is earning its place —
before any visual execution gets chosen. A UI choice made before these
questions are answered defaults to whatever's statistically average for
the genre (Section 0), which produces both AI-slop visuals and AI-slop
*information architecture* (Section 18) — bloat is what happens when a
screen gets dressed before anyone decided what it's actually for.

---

## 11. Data Drives the UI

The shape of a screen should come from the actual shape of the data on
it — not from whatever the default table/list/card looks like before
anyone's thought about what's actually being shown.

- A field with a small, fixed set of values (status, department, task
  type, priority) becomes a colored chip, not a plain text column —
  there's a finite vocabulary, so encode it visually instead of asking
  the user to read every row.
- Numbers right-align so digits line up by place value. Long text
  truncates rather than squeezing everything else.
- Time-ordered, "what happened when" data is a timeline before it's a
  sorted table — a sorted-by-date table technically works, but it's not
  letting the data pick its own shape. (This app already does this
  right in places — `grid-tasks`, the calendar widgets — worth holding
  as the standard for new widgets, not a one-off.)
- Color in a dashboard is never sprinkled in for visual interest — see
  Section 2's claimed-semantic-colors table. The reason red/amber/
  emerald/teal exist isn't "the screen needed more color," it's that
  each one is standing in for a real property of the data (urgency,
  priority, status, an active remote session).
- An avatar or icon next to an identity column isn't decoration — it's
  a faster lookup path than reading a name, because the eye matches
  shapes/colors faster than it reads text.
- **A table's structure is decided by what the user is doing with it,
  same as everything else in this section** — ask first whether a given
  table is for *scanning* (most rows glanced at, few acted on —
  left-align text, right-align numbers, minimal separators so the eye
  moves fast), *comparing* (numbers across rows is the actual task —
  monospace figures, as Section 1 already establishes for IDs/
  timestamps), or *acting* (each row has real per-row controls — this is
  where Section 12's tap-not-hover disclosure rule applies, not a
  table-specific exception to it: per-row actions reveal on a deliberate
  tap or an always-visible affordance, never on hover, for the same
  reason header controls already do).

---

## 12. Progressive Disclosure & the Spectrum of Explicitness

What's shown by default vs. revealed on demand should track how often
and how important an action actually is — not "show everything,
always," and not "hide everything behind a menu" either. There's a
spectrum: a primary action is always visible; a secondary one shows up
when the user is already looking for it; a rare one is tucked one step
deeper still.

**This product's no-hover rule (Section 6) changes how this gets
implemented, not whether it applies.** The video's own version of this
relies on hover to reveal secondary actions — that mechanism doesn't
exist here. The same disclosure logic has to be expressed through a
deliberate tap (a "..." overflow, a long-press, a one-level-deeper
menu) instead of a hover reveal.

**A concrete place this app gets the structure wrong, independent of
the animation:** the settings cog reveals up to six actions (add, tidy,
reset, cancel, save, theme) inline, all at equal visibility, the moment
it's tapped. Those six don't deserve equal explicitness — theme is rare,
Save/Cancel only exist mid-edit, Tidy/Reset are occasional. The
choreography around this was already calmed down (see Changelog), but
the structure — six equally-prominent items appearing at once — is the
deeper issue. A real fix groups the rarely-needed ones a step further
in, rather than just toning down how they animate in.

**Onboarding is this same principle applied to a first-time user:** one
hint pointing at the next single action, not a feature-tour modal with
a bullet list the moment someone logs in. Nothing here currently
implements onboarding either way — flagging this as forward guidance
for whenever it's built, not a found defect.

---

## 13. UI Is What You Can't See

A meaningful share of a finished product is the layer a user doesn't
see by default: tooltips on ambiguous icons, empty/error states, a
restrained first-run hint instead of a tour. Skipping this is what
makes something feel unfinished even when every visible pixel is
polished — the visible part is the easy 80%; orchestrating the
invisible part is the actual work.

**This app already has a real, specific version of this problem.**
13 icon-only controls across the dashboard/grid files (the resize
handle, the settings cog, the widget expand button, others) rely
solely on the native HTML `title` attribute for their explanation.
`title` tooltips are hover-triggered — on a touchscreen kiosk with no
pointer (Section 6), they functionally don't exist. The markup is
there; the affordance isn't. Any icon-only control that needs
explaining needs a touch-compatible mechanism instead — a persistent
micro-label, a first-use contextual hint, or a long-press reveal — not
just a `title` attribute and hoping.

---

## 16. User Flow

A flow is correct when three things are always true: the user knows
something is happening right now, the user knows what just happened, and
the user knows how to get back. Most "this feels unfinished" reports trace
to one of those breaking somewhere, not to a single screen looking wrong.
This section is grounded in an actual audit of this app's flows (login,
signup, dashboard edit mode, task completion, remote view, connection
loss, forms/messages) — not general UX advice — and gets extended the
same way: trace a real flow, cite the file/line, fix or state the
exception.

**Found and fixed before this section existed:** the dashboard's edit-mode
entry/exit (Section 12's settings-cog rework), the default-layout fallback
so a new location doesn't open to a blank grid (layouts.ts), and the
quote/clock widgets losing an expand button that led nowhere useful.

**Found, real, still open:**

- **An action can fail with zero feedback.** `handleSave` in
  `grid-dashboard.tsx` POSTs the edited layout; if it throws, the `catch`
  block is empty (`// stay in edit mode`) — no error message, no retry
  prompt, nothing. The user taps Save, nothing visibly happens, and they're
  left to guess whether it worked. Contrast with the drag/resize collision
  state in `widget-container.tsx`, which gets this right: a blocked move
  visibly does nothing (the widget doesn't follow the pointer into an
  invalid cell) rather than silently appearing to succeed. Save needs the
  same honesty — at minimum, a visible error state that doesn't require
  reading the network tab to discover.
- **Reconnection has no backoff or give-up.** `connection-status.tsx`'s
  `startReconnect` polls `/api/auth/me` every 5 seconds, indefinitely, with
  no escalation if the server is actually down rather than just slow. A
  kiosk left running overnight against a dead backend sits in
  "Reconnecting…" forever with no different message at 10 seconds vs. 10
  hours.
- **A user-triggered action can fire twice because nothing shows it's in
  flight.** `task-form-modal.tsx`'s Create/Update Task button only disables
  when the title is empty — never while the save request is actually in
  flight, so a fast double-tap fires duplicate POSTs. Same gap in
  `forms-repository.tsx`'s delete-confirm button and the duplicate-check
  action on `/admin/tenants/[id]/data-management`. Not a uniform problem —
  `user-management.tsx`'s own `handleSave` and `tenant-settings.tsx`
  already wire `saving`/`Loader2` correctly elsewhere in the same files;
  the fix is closing the specific gaps, not inventing a new pattern.
- **The most common single action in the kiosk UI fails silently.**
  `dashboard/page.tsx`'s task-completion checkbox — tapped more than
  anything else on this surface — reverts the optimistic checkmark on a
  failed request by just re-fetching, with no error shown either on the
  failure branch or in the catch block. A user who taps a checkbox during
  a flaky connection sees it un-check itself with no explanation.

**Found, and a stated exception rather than a defect:** the remote-view/
mirroring flow (`remote-view-banner.tsx`) auto-starts when an ARL user
begins viewing or controlling a location's screen — the code comment says
so directly ("Auto-start... no consent needed") — and the location side has
no button to end the session itself (`endSession` is defined but never
wired to the UI; only the ARL side can end it). This is deliberate, not an
oversight: ARL is a trusted internal role overseeing locations it manages,
analogous to a manager looking over someone's shoulder, not an outside
party. The banner's job is to keep the session *visible* (a bordered inset +
"Being viewed/controlled by [name]," per Section 10's status-dot logic),
not to gate consent. Stating this here so a future pass doesn't "fix" it
into a confirmation dialog the actual use case doesn't want.

**Onboarding** for a first-time user is intentionally out of scope here —
Section 12 already covers it as forward guidance, not a found defect.

**Check:** after any user-initiated action that hits the network, ask "if
this fails right now, what does the user see?" If the answer is "nothing,"
that's the same class of bug as `handleSave`'s empty catch — find it the
same way (grep for empty `catch` blocks around `await` calls that update
UI state on success). Separately, ask "if this takes three seconds, does
the user know it's working?" If the trigger control looks identical
mid-request and at rest, that's the same class of gap.

**Widgets are quick access; routes are the full version — not a choice
between them.** A "widget," by the term's own ordinary meaning, implies a
fuller version exists somewhere — Calendar already had this (a real
`/calendar` route) well before Tasks or Messages did, which only had
same-page modals/overlays standing in for a "full version" that didn't
actually exist as its own place. Tasks (`/tasks`) and Messages
(`/messages`) now have real routes too, and the dashboard's widgets are
quick-access launchers into them — tapping a widget's expand affordance or
its main tap target navigates there instead of opening an in-place overlay.
This isn't a sidebar-nav rewrite of the dashboard (considered and rejected
— see below): the dashboard stays the nav-free ambient surface; `/tasks`,
`/messages`, and `/calendar` get a slim shared header (`SubPageHeader`)
with a back-to-dashboard link and quick links between siblings, so moving
between the three full pages doesn't require round-tripping through the
dashboard, without turning the dashboard itself into something you browse.

**A sidebar nav for the kiosk side was proposed and rejected.** The
original ask was a full collapsible sidebar (the same pattern ARL uses)
replacing widgets as the primary way to reach the full version of
anything. Rejected because ARL's sidebar fits ARL's job (genuinely
multi-page admin work); the dashboard's job is "glance at a status board,
tap to act, walk away" — a sidebar imports a multi-page mental model into
a screen whose whole point is not being that. The widgets-as-launchers
model above gets the same practical outcome (a real full version exists
for things that need one) without that tradeoff.

**Routing in introduces a real risk a modal didn't have, and the
inactivity timer (`use-inactivity-redirect.ts`) is the stated mitigation,
not a nice-to-have.** A modal always returns you to exactly where you were
on dismiss; a routed page requires deliberate back-navigation, so an
unattended kiosk can get stranded on `/tasks` if someone walks away
mid-task. Standard kiosk pattern (POS systems, check-in kiosks, self-
checkout all do this): idle timeout returns to the dashboard — but never
silently. A countdown warning shows first and any tap cancels it, because
an un-cancelable or silent redirect reads as broken, not helpful. Scoped
to kiosk/desktop only (gated in `SubPageHeader`, the one mounting point
for every sub-page) — never mobile (no idle-kiosk risk on a personal
phone), and it doesn't apply to ARL at all since this header doesn't
render there.

**Messages (`/messages`) is a stated v1, not full parity with the
dashboard's chat overlay.** `RestaurantChat` is a large (1100+ line),
already-working component tightly coupled to its own slide-out/fullscreen
toggle UI — voice messages, reactions, mentions, group-chat creation,
in-thread search, mute. Replicating all of it on the new route in the same
pass this took to build the route itself would have been a much bigger,
riskier change than the route needs to be useful. `/messages` ships with
text messaging, real-time updates via the same socket events, and read
state — a real macOS-Messages-style two-pane layout (thread list always
visible, active thread beside it, never replacing it) that the overlay
can't do since it can only show one or the other. The deferred features
are a known, named gap, not a silent omission — extend `/messages` to
close them rather than building a second messaging surface.

---

## 18. Redundancy & Earned Presence

Every element on screen has to earn its place independently — not by
being well-built in isolation, but by giving the user something they
can't already get from this same screen-visit. The failure mode this
guards against doesn't show up in any single-element check elsewhere in
this doc (Section 11 asks whether one element's *shape* matches its
data; this asks whether the element should exist *at all*, given
everything else already on screen) — it's screen-level, not
element-level, and it's exactly the gap an AI-generated UI tends to
produce: every individual piece looks considered, but the screen as a
whole restates itself.

**Two concrete instances found in this app, both well-built individually
and both unnecessary together:** a pulsing-dot "● Live" label next to a
feed header that's already named "Live Activity" and already updates in
real time (`live-activity-feed.tsx`) — the label restates what the
real-time updates already demonstrate on their own. And a global
task-completion toast (`arl/layout.tsx`) that fires on every ARL page,
including the one page that already shows the identical event in a
persistent, scrollable feed — redundant specifically there, not
everywhere, since the toast is the only mechanism telling you about
activity on every *other* page. The fix in both cases was scoped to
where the redundancy actually lives, not a blanket "remove one of them."

- **The "already said it" test**: if this element disappeared, would
  the user lose information or capability they can't get elsewhere on
  this same screen-visit? If no, it's restating, not adding.
- **The "genre default" test**: does this element's presence trace to
  this screen's actual data or task (Section 11), or to what a screen
  like this usually has (a stat-card grid, a "Live" badge, a hero CTA)?
  Recognizable-because-common is exactly why its presence needs its own
  justification, not an assumption that more dashboard-shaped furniture
  reads as more finished.
- **Two surfaces managing the same underlying concept** (a composer for
  X and a viewer for X, built as separate cards) is a signal to check
  whether the surface they both feed already treats them as one thing —
  if it does, the two cards are an artificial split, not two real needs.

**Check:** for any two elements that reference the same fact (a count, a
status, an event), ask which one a user would actually miss if the other
were deleted. If the honest answer is "neither, really," keep the one
with more information (history, detail, a way to act) and cut the one
that's purely restating it.

---

## 19. Copy & Microcopy

Every piece of UI text earns its length the same way a UI element earns
its presence (Section 18) — concise and specific reads as professional;
padded and generic reads as a first draft. This applies to button
labels, dialog titles, descriptions, and confirmation copy alike.

- **Button/action labels name the object, not the manner.** "Delete
  User" / "Delete Location", not "Delete Permanently" — *permanently* is
  already implied by the action being a delete in the first place, and a
  destructive label's job is to say *what* gets deleted so the user can
  sanity-check it at a glance, not to editorialize about how thoroughly.
  A concrete instance found in this codebase: `user-management.tsx`'s row
  overflow rendered the literal label "Delete Permanently" for both ARLs
  and Locations — generic, and longer than the specific version. Fixed to
  "Delete User"/"Delete Location".
- **Confirmation copy states the consequence in one short sentence, not
  a warning essay.** "Delete David Santos? This cannot be undone." says
  everything a "Permanently delete David Santos? This action is
  irreversible and cannot be undone" version does, in half the words.
  If the description needs two sentences, the second one should be new
  information (what else gets deleted with it), not a restatement of the
  first.
- **Every destructive action requires a confirmation step — no
  exceptions.** This is the one copy rule that's also a behavior rule:
  a destructive button click is never the action itself, only the
  trigger for a confirm dialog that states the consequence and requires
  a second, deliberate click. A concrete instance found in this codebase:
  `task-manager.tsx`'s task delete called the DELETE endpoint directly
  from the row's trash icon with no confirmation at all, while every
  other destructive action in the console (`user-management.tsx`,
  `forms-repository.tsx`, `scheduled-meetings.tsx`) already gated through
  `useConfirmDialog`. Fixed to match.
- **Don't restate what the icon or label position already communicates.**
  A trash icon next to "Delete" doesn't also need "(cannot be undone)"
  appended to the button label itself — that belongs in the confirmation
  step, where it's actually load-bearing (the user is about to act), not
  on the trigger, where it's just longer text to scan past.

**Check:** read every button label and dialog title out loud. If a word
could be deleted without losing meaning, delete it. If a destructive
action's button click does anything other than open a confirmation, that's
a missing confirmation, not a style choice.

---

## 20. Earned Delight

Every other section in this doc is a brake: does this color/icon/shadow/
animation/element earn its place, or is it decoration wearing a
functional costume? None of them is an accelerator — nothing in this doc
ever asks whether a screen has earned some *warmth*, only whether it's
avoided looking cheap. Applied consistently, a doc built entirely out of
brakes produces a correctly-restrained app that can still read as
sterile, because restraint was the only motion available. This section
is the counterweight, held to the same rigor as everything it balances —
it is not permission to add flourish for its own sake, which would just
be slop pointed in the other direction.

**This section applies to the Dashboard/kiosk surface specifically, not
the ARL or Admin Consoles.** Those two are dense work tools for people
managing many locations or tenants at once — their stated reference
anchors (Linear, Stripe/Vercel) are correct for that job, and restraint
is the right choice there, not an oversight to correct. The Dashboard is
different: it's used dozens of times a day by the same hourly frontline
staff doing repetitive work, which is exactly the situation where a
small, well-placed moment of warmth pays for itself, and exactly the
situation gamification used to serve before it was removed for reasons
unrelated to this doc (see Changelog, 2026-06-16) — this section is not
a mandate to rebuild points, streaks, badges, or leaderboards. Those were
social/competitive systems; this is about acknowledging one person's own
progress back to them, on the surface they already use, not building a
second system next to it.

**The earned-delight test — Section 18, pointed the other direction:**
find a moment on the kiosk surface that represents real accomplishment
or relief for the person experiencing it, then check whether the UI
currently treats it identically to a routine, forgettable interaction.
If it does, that gap — not the absence of decoration in general — is
what has earned a deliberate flourish.

A concrete instance already sitting in this codebase, unfixed: the
Tasks widget's completion ring (`grid-tasks.tsx`) animates its
stroke-dashoffset the same 0.5s ease at 40% complete as it does at 100%
— finishing every task for the day is currently indistinguishable, UI-
wise, from checking off one task out of ten. `remainingCount` already
hits zero in the existing state; nothing downstream of that moment does
anything with it. That's the kind of gap this section is for — not
"the dashboard needs more animation," but "this specific, already-
tracked event earns a specific, bounded response it doesn't currently
get."

**Guardrails, so this doesn't become the next Do Not Use entry:**

- **Scale intensity to rarity.** A flourish that plays on every routine
  check-off stops being a signal within a day and becomes ambient noise
  — worse, it becomes exactly the "boilerplate animation" Section 9
  already bans. The rarer and more genuinely complete the event (last
  task of the day, not task #4 of 10), the more it's earned a response;
  routine progress keeps its routine, restrained treatment.
- **Still passes every existing rule.** No hover-only trigger (Section
  6), no stacking multiple decorative effects on one element with no
  individual reason for each (Section 17), still communicates a result
  and doesn't play "whether the action succeeded, failed, or did
  nothing" (Section 9's own micro-interaction test already covers this
  — earned delight is that test's rare-event case, not an exception to
  it).
- **One clear trigger, one bounded effect — stated, not vague.** "Add
  some celebration" is not a spec. "When `remainingCount` reaches zero
  for the first time that day, the completion ring holds a distinct
  filled state for N seconds before settling" is. If a proposed flourish
  can't be stated this specifically, it isn't ready to build.
- **Never blocks or delays the next action.** A kiosk user still has a
  shift to run; a flourish that can't be tapped past, or that gates the
  next real task behind itself, has become friction wearing a reward
  costume — the exact inversion of what this section is for.

**Proposed and agreed before building — same precedent as the quote
widget's exception.** That exception wasn't self-granted by whoever
touched the file; it was user-requested and agreed for one named reason
before it shipped. Nothing in this section is a standing license for
any future change to invoke "earned delight" unilaterally — a specific
trigger and effect gets named and agreed first, the same way the check
below requires, not discovered after the fact by pointing at this
section.

**Start with one instance, not a program.** This section exists because
of exactly one concrete, unfixed gap (the completion-ring case above) —
not a mandate to sweep the Dashboard for delight opportunities. Ship
that one, live with it, and decide whether a second instance is worth
proposing only after seeing how the first actually lands. A section
that greenlights one considered exception is very different from one
that opens a backlog.

**Named failure mode — delight inflation.** The way this section decays
into new slop: a flourish ships for one rare, earned moment, then
quietly starts appearing on routine ones too, because the code already
exists and reusing it is easier than asking whether the new occurrence
still earns it. This is the Section-20-specific case of the Do Not Use
list's boilerplate-animation entry, and the check against it is the same
one that governs adding a new instance in the first place: does *this*
occurrence still pass the rarity test, or is it just present because the
mechanism was already sitting there.

**Check:** name one specific moment on the Dashboard surface where a
real accomplishment currently gets the same treatment as routine
progress. State the exact trigger and the exact bounded effect, get it
agreed before building it, and don't propose a second instance until
the first has shipped and been evaluated. If the trigger or effect can't
be stated concretely, or if it's the second-or-later instance proposed
in the same pass, it isn't a proposal yet.

---

## Part B — UI: Executes the UX

Once Part A's questions are answered — what the user needs, when, and
why a given element earns its place — these sections govern how that
gets expressed visually: type, color, spacing, layout, affordance,
hierarchy, dark mode, motion, icons, and the specific patterns that read
as generated rather than designed. None of these can rescue a screen
that skipped Part A — a beautifully typeset, perfectly spaced
restatement of information the user already has is still bloat.

---

## 1. Typography

Two typefaces, each chosen deliberately and doing a distinct job — not
one default stretched over every use case, and not picked per-component
on the fly:

- **Manrope** (`--font-sans`) — UI text: labels, body copy, headings.
- **Space Mono** (`--font-mono`) — anything that's actually tabular or
  code-like: the clock, PINs, session/connection codes. A real
  monospace face, not a sans-serif font with `tabular-nums` standing in
  for one.

Both are self-hosted the same way (`next/font/local`, static `.woff2`
in `src/app/fonts/`) for kiosk/offline reliability — no Google Fonts
CDN at runtime.

**Four sizes, named by job, not by how they were used last time:**

| Role | Size | Tailwind | Used for |
|---|---|---|---|
| Caption | 12px | `text-xs` | metadata, timestamps, badges |
| Body | 14px | `text-sm` | the default for UI text — labels, list items, controls |
| Title | 18px | `text-lg` | widget/card/modal titles |
| Display | 24px | `text-2xl` | page-level headings |

`text-base`/`text-xl`/`text-3xl`+ are not part of the scale — round to
the nearest tier above instead of reaching for an in-between size.
Marketing/landing-page headlines are the one stated exception (per
Section 0's "more expressive range only where content calls for it"),
not a license to use an in-between size in ordinary UI.

**Two weights — Regular (400) and Semibold (600).** Checked against
actual usage before picking these: `font-medium`/`font-semibold`/
`font-bold` were nearly evenly split across the *same* size tiers with
no consistent role separating them (e.g. `text-sm font-medium` and
`text-sm font-semibold` both showing up ~20+ times for what was
evidently the same job) — that's drift, not a deliberate 3-tier
hierarchy, so it collapsed to two: Regular for body/secondary text,
Semibold for everything that needs emphasis (labels, titles, buttons).

**Stated exception — `font-black` (900), a display register, not a
third UI weight.** Reserved for: numeral/code displays (clock, stat
numbers, session codes — usually paired with `tabular-nums` or
`font-mono`), single-character brand marks (logo monograms, avatar
initials), marketing headlines, and safety-critical alert headings
(emergency overlay, overdue-tasks banner). The common thread is "not
ordinary UI text" — if it's a label, a button, or a paragraph, it
doesn't qualify no matter how much emphasis it seems to want.

**Font floor — never shrink to compensate for space.** 12px is the
absolute minimum anywhere, reserved for captions only; body text has a
14px floor. Mobile gets the *same* floors as kiosk/desktop, not smaller
ones — the failure mode this guards against is a future `sm:text-base
text-xs` pattern that shrinks text specifically because the viewport
got smaller, which is the opposite of what a smaller, closer-held
screen needs. Form inputs have their own stricter 16px floor
(`globals.css`'s `@supports (-webkit-touch-callout: none)` block) to
stop iOS from auto-zooming on focus — that's a platform constraint, not
a style choice, and it's a higher floor than body text's because it's
solving a different problem.

**Stated exception — the on-screen keyboard's keys (`onscreen-
keyboard.tsx`).** `text-[15px]` on every key, applied via one shared
constant, not picked per-key — a deliberate, single, already-consistent
choice for tap-target legibility on a touch keyboard, where rounding
down to Body (14px) would make a legibility-critical control marginally
harder to read for no actual benefit. Don't extend this 15px value
anywhere else; it's scoped to this one component.

Both typefaces are self-hosted the same way (`next/font/local`, static
`.woff2` in `src/app/fonts/`) for kiosk/offline reliability — no Google
Fonts CDN at runtime. Body text wraps at roughly 75 characters per line.

**Check:** any inline font-size or font-weight that isn't one of the
four sizes/two weights above (or a named, stated exception) is a
violation, not a judgment call. Any digit-only display (time, codes,
IDs) using `--font-sans` with `tabular-nums` instead of `--font-mono`
is also a violation — that's the "one safe font" tell, just disguised
with a CSS property.

---

## 2. Color

Every color on screen has a job — palette, brand, or semantic — and
that job is stated, not implied. Semantic colors (error, success,
warning) are reserved for that meaning only; reusing them decoratively
elsewhere dilutes the signal. Color reinforces a distinction already
made by size, position, or weight — it's never the only signal.
Minimum contrast is WCAG AA (4.5:1 body text, 3:1 large/UI text),
non-negotiable.

**Claimed semantic colors** — check this list before introducing a new
color for a new meaning; reuse before adding.

| Color | Meaning | Token |
|---|---|---|
| Red | Brand / urgent / destructive / active-selected | `--hub-red` |
| Amber | Priority warning / "you are in control" (remote sessions) | Tailwind `amber-*` |
| Emerald | Success / online / connected | Tailwind `emerald-*` |
| Teal | Remote mirroring/viewing session is active | `--hub-teal`, `--hub-teal-light` |

**Decided: primary action color is a chromatic neutral, not brand red.**
Buttons, selected states, and other primary-action chrome use the
highest-contrast neutral available — near-black on light, near-white on
dark — never `--hub-red` or any other chromatic color. This was chosen
over a solid-red or tinted-red primary (both prototyped in
`/design-preview`, "Direction A — Neutral" vs. B/C) because red is
already claimed above for brand/urgent/destructive/active-selected —
every chromatic primary button would have spent that same signal on
routine "Save"/"Add" actions, weakening red's meaning everywhere else.
Reserve chromatic color for data; reserve the primary-action slot for
the neutral. (Matches Linear, Stripe, Raycast.)

---

## 3. Spacing & Shape

**8pt grid.** Spacing that creates *rhythm/grouping* — padding, margin,
gap — is primarily a multiple of 8px: `gap-2`/`p-4`/`m-6`/`gap-8`
(8/16/24/32px), and so on. A **4px half-step is a stated exception**,
not a loophole: real 8pt systems are usually documented exactly this way
(Material's is "4dp base unit, 8dp grid for layout") because 8px alone
is too coarse for icon gaps and dense-control padding. So `gap-1`/`p-3`/
`gap-5` (4/12/20px) are fine. What's an actual violation is anything
*finer* than the 4px half-step — `gap-1.5`/`p-2.5`/`gap-3.5` (6/10/14px)
— those read as an eyeballed pixel nudge, not a value taken from the
scale.

**This rule is scoped to rhythm, not geometry.** Position offsets
(`top`/`right`/`bottom`/`left`/`inset`) and element dimensions (`w`/`h`)
are exempt even when they use a `.5` value — `-right-0.5 -top-0.5` to
sit a notification dot precisely on a corner, or `h-0.5` for a hairline
divider, are solving a pixel-precision problem the 8pt grid doesn't
apply to. The grid is about the space *between* things; corner overlaps
and line thicknesses aren't that.

**Check:** any padding/margin/gap value finer than 4px (`0.5`, `1.5`,
`2.5`, `3.5`) is a violation. `0`/`1`/`2`/`3`/`4`/`5`/`6`/`8`/`10`/`12`+
are all fine (every whole Tailwind unit from here up is already a
multiple of 4px).

Radius: this product's house style is a **heavy, near-uniform radius**
— large, soft corners across cards, containers, and controls, rather
than a tightly differentiated scale per role. This is a deliberate,
stated choice (per Section 0), not the default-because-nobody-decided
version of heavy rounding the Do Not Use list warns about — the
difference is that here every surface uses the *same* considered
radius on purpose, consistently, as a named part of the visual
identity. True circles (dots, avatars, status indicators, pill-shaped
chips) remain `rounded-full` as before. Shadow/elevation is otherwise
minimal-to-flat — prefer fill-color contrast between surfaces over
shadow to establish separation (see Section 8 for how this extends to
dark mode); reserve shadow for true overlays (modals, dropdowns) where
something needs to read as floating above the page.

**Stated exception — dashboard grid widgets:** widget cards keep three
corners at the standard radius but tighten the bottom-right corner
(`rounded-br-md` against `rounded-*-3xl` elsewhere on the same card —
the same radius used for containers like the login card and modals).
This mirrors the chat message bubbles' pinched corner, but repurposed:
chat tightens whichever corner faces the sender (a directional cue);
widgets always tighten bottom-right because that's where the resize
handle lives in edit mode. Same shape logic — "this corner is
different because something lives there" — pointed at a different
fact. Reset to uniform corners when a widget is expanded, since the
resize handle isn't shown in that state. Don't extend this asymmetry to
modals, buttons, or other surfaces that don't have a reason for it.

**The "near-uniform" radius is several tiers, not one value — tied to
role, not to taste.** "Heavy, near-uniform" doesn't mean a single
literal radius everywhere; it means each *role* has one settled value,
reused everywhere that role appears, rather than a new pick every time
a component is built. In practice:

| Role | Radius | Examples |
|---|---|---|
| Primary/largest containers (the main card on a page, a full takeover modal) | `rounded-3xl` | Login card, `emergency-overlay.tsx`, a dashboard widget's outer frame, `grid-mobile-stack.tsx` rows |
| Secondary containers (floating dropdowns, popovers, in-page modals) | `rounded-2xl` | `Dialog`, `Menu`/`Select` content, `grid-dashboard.tsx`'s header popovers, `connection-status.tsx`'s session panel |
| Icon-avatar boxes and input fields (≥ `h-8`) | `rounded-xl` | Every colored icon-chip next to a title (forms, chat, widgets), `Input`/`Textarea` |
| Small icon-only buttons (`h-6`–`h-10`, no icon-avatar fill) | `rounded-lg` | `DestructiveIconButton`, `ModalCloseButton`, every close/back/dismiss icon button app-wide |
| Small inline category/type tags (colored text chip, not the shared `Badge`) | `rounded-md` | `arl-cursor-overlay.tsx`'s presence tag, a form's category color chip |
| True circles — avatars, status dots, pill buttons/chips, date-number badges | `rounded-full` | `Avatar`, `StatusDot`, tab pills, a calendar's "today" badge |

The check for a violation isn't "is this radius different from that
one" — different roles are *supposed* to differ — it's "do two
elements playing the *same* role disagree." A close-icon button that's
`rounded-lg` in one file and `rounded-xl` in another with no stated
reason is the violation; a modal being `rounded-2xl` while its own
icon-avatar chip is `rounded-xl` is the system working as designed.

---

## 4. Layout

Most elements align to a small, consistent set of shared lines across a
given page — not rigidly centered as a single column (the lazy
default), and not scattered with no shared alignment (no grid
discipline). When something intentionally breaks the grid, it's the
only thing on the screen doing that — two grid-breaking elements in one
view reads as sloppy, not intentional.

**A layout that uses two directions at once (rows and columns
simultaneously, like the dashboard's free-form grid) is a desktop/kiosk-
width pattern, not a universal one.** Below the mobile breakpoint, commit
to one direction — a single vertical stack — rather than rendering a
shrunk copy of the two-directional layout. Shrinking a layout that
depends on width to read correctly doesn't preserve it, it clips it.
This is why the dashboard renders a completely different component below
640px (`grid-mobile-stack.tsx`) instead of scaling `GRID_COLS`/`GRID_ROWS`
down — see the Changelog.

---

## 5. White Space & Proximity

Space communicates grouping, not leftover area. Items in the same
logical group sit noticeably closer together (roughly 2-3x closer) than
to items outside the group. Uniform spacing everywhere, regardless of
relationship, is one of the most common tells — it signals no grouping
decision was made. Macro spacing between unrelated sections should be
large enough that a divider line isn't needed to signal the context
changed.

**Check:** squint at a screenshot until text is unreadable — you should
still be able to tell where the logical groups are, purely from
spacing.

**A card's interior padding should read as more spacious than the gap
separating it from its neighbors, not less.** The gap between cards
only has to signal "these are different things"; the padding inside a
card is containing content the user is meant to read or interact with,
and undercutting the outer gap makes that content feel like it's
pressing against the card's edge instead of sitting inside it. Found
as a real instance: the dashboard grid's card gap was 12px while
several widgets' internal list padding was 8px — backwards. Fixed by
widening the gap and bringing interior padding up to match or exceed
it, not by shrinking the gap to meet the padding.

---

## 6. Affordances & Signifiers

This product is used on kiosk touchscreens — there is no mouse, no
cursor, no pointer that can ever be "over" an element without also
pressing it. **Hover is not part of this product's input model and
should not be designed as a feedback state.** Beyond just being
invisible to real users, `:hover` on touch devices is actively buggy:
many mobile/tablet browsers fire it on tap and then leave it "stuck"
until something else is tapped, so a hover-styled button can look
permanently active/highlighted for no reason. Design every interactive
element's feedback around rest → active/press → disabled instead — that
sequence is fully meaningful on a touchscreen, and hover isn't.

Every interactive element looks different at rest vs. active/press vs.
disabled — a real state change, not a 5% opacity shift. Elements that
act as a connected set (tabs, segmented controls, toggle pairs) are
visually contained as one unit, not floating as separate pieces that
happen to be near each other. Disabled state is unmistakable at a
glance.

**Check:** any `hover:` class that is the *only* place a piece of
feedback is defined (no corresponding active/press treatment) is a
violation — that feedback is invisible on this product's actual
hardware.

**A pill/card background is itself a signifier — "this is a button" —
so it shouldn't wrap content that isn't one.** Passive identity/status
content (a logo+name block, a clock, a label) gets no background at
all. Wrapping passive content in the same shape as real buttons is a
false affordance — it tells the eye "interactive" about something that
isn't.

**Among things that *are* tappable, the pill is further reserved for
disclosure controls specifically — something that opens a panel rather
than completing an action on its own (Settings: opens Customize/Reset;
Connection Status: opens session info).** A direct, momentary action
(Theme, Sign Out) stays a bare icon with only an active/press state,
no resting container. The distinction isn't decorative: a closed door
to more UI benefits from looking like a discrete object (there's
something behind it); a verb that completes immediately doesn't need
one. Giving every tappable header control the same pill regardless of
this difference is the same "every tile gets identical chrome"
sameness already named in Do Not Use for widget cards — being tappable
isn't enough on its own to earn the pill.

**Check:** before adding `.pill` to a new header control, ask whether
tapping it opens something or just does something. If it just does
something, it doesn't get the pill no matter how important the action
is.

---

## 7. Visual Hierarchy

Exactly one dominant element per screen or section — never two
competing "primary" actions in the same view. Metadata is visually
subordinate (smaller AND lower contrast, not just smaller). Hierarchy
is built from at least two of size/weight/color/position — color alone
is not hierarchy.

**Check:** remove all color from the screen. If it becomes impossible
to tell what's important, hierarchy was being faked with color instead
of built with layout.

---

## 8. Dark Mode Depth

Dark mode is a separate design pass, not light mode inverted. Elevation
is communicated by surfaces getting *lighter* as they sit closer to the
user (base darkest, cards lighter, modals lighter still) — shadows
barely register on dark backgrounds, so they can't carry this alone.
Pure black backgrounds are avoided in favor of a dark, slightly
desaturated near-black. Accent color saturation is reduced relative to
light mode. Borders carry more separation work since shadows are weak.

**Check:** if dark mode looks like the light palette run through a
naive invert — flat, no sense of which surface sits above another — it
wasn't designed as its own pass.

---

## 9. Motion

Every interactive element with a press state has a transition defined —
instant, untransitioned state changes are a tell. (Not hover — see
Section 6; this is a touchscreen product.) A single standard
duration/easing should govern ordinary feedback (a reasonable default
until something more specific is decided: ~150-200ms, ease-out); motion
exists to communicate something, not to decorate.

**Watch for Framer Motion's `layout` prop causing unrelated siblings to
visibly resize/spring.** A flex item with `flex-1` next to a sibling
that conditionally mounts/unmounts will grow or shrink whenever that
sibling changes — adding `layout` there doesn't smooth a real
transition, it just animates a side effect nobody asked for (e.g. a
brand/identity block visibly stretching every time an unrelated status
chip appears or disappears next to it). If something needs to look
stable, don't give it a width that depends on its neighbors, rather
than papering over the resulting jiggle with a spring.

**Micro-interactions communicate a result, not a mood.** A small animation
on a meaningful state change (a task checking off, a save completing) is
worth having — it confirms the action landed — but it earns its place by
marking *that specific event*, not by existing everywhere as ambient
polish. If the same flourish would play whether the action succeeded,
failed, or did nothing, it isn't a micro-interaction, it's decoration with
extra steps.

---

## 10. Selection & Status Patterns

Two small, reusable atomic patterns — apply wherever a list needs them,
independent of any single screen's broader style:

- **Selected state = solid inverted fill**, not a border, checkmark, or
  tint. When one item in a list/group is the active/selected one, give
  it a full solid fill (the page's high-contrast neutral, inverted —
  e.g. a light row turning solid dark with light text) rather than
  outlining it or bolting on a separate indicator icon. Reserve this
  for genuine single-selection state, not for hover (this product has
  none, see Section 6) or static emphasis.
- **Status = a small colored dot + plain-weight label**, not a heavy
  colored badge or colored block of text. The dot's color carries the
  semantic signal; the label stays normal weight. Group in a light pill
  only if the surrounding layout needs the grouping — the dot+label is
  the unit, not the pill.

---

## 14. Icons

One icon library, one default treatment, used everywhere — `src/lib/icons.tsx`
is the only place an icon set gets imported (currently Phosphor, wrapped with
a `duotone` default), re-exported under familiar Lucide-style names. No
component imports `lucide-react` or `@phosphor-icons/react` directly; if a
needed icon isn't in the barrel file yet, it gets added there, not
hand-imported locally. This isn't a hypothetical rule — it's already true
across the codebase and worth keeping true on purpose rather than by accident.

- **Same icon = same meaning, everywhere.** Don't reuse an icon already
  standing for one action (e.g. the settings gear) for a different,
  unrelated one elsewhere, and don't introduce a second icon for an action
  that already has one (two different "remove" icons in two different
  files is a sign nobody checked).
- **Size comes from the existing scale, not a one-off.** This app already
  converges on a handful of sizes used for the same kind of control
  everywhere (`h-3.5 w-3.5` inline-with-text, `h-4 w-4` standalone buttons,
  `h-5 w-5` larger touch targets). A new icon usage should match the size
  already used for that role, not introduce `h-4.5` because it looked right
  in isolation.
- **Icon-only controls still need the Section 13 treatment** — a real icon
  doesn't make a control self-explanatory by itself; it still needs a
  touch-compatible label (`IconTip`, not `title`).

**Icons must earn their place — Section 18 applied specifically to icons.**
An icon isn't automatically "free" polish; it costs visual weight and
attention like any other element on screen, so the same earned-presence
test applies:

- **Does it communicate something the label/color/position doesn't
  already?** A trash icon next to "Delete" is fine — it's a faster visual
  lookup path than reading the word. A generic icon glued onto plain body
  text or a section heading that already says what it means in words adds
  nothing beyond "this section has an icon now."
- **Is it functional or decorative?** An icon inside a colored icon-avatar
  box next to a title is establishing identity, the same pattern Section
  15 documents for list rows and section headers. A stray icon dropped
  into a sentence, a bullet list, or next to a label purely because the
  layout felt bare without one is decoration wearing a communication
  costume.
- **Would removing it lose the user anything?** Apply Section 18's
  "already said it" test directly: if this icon disappeared, would the
  user lose information, a faster lookup path, or a signifier they can't
  get from the text/color/position already there? If the honest answer is
  "no, it would just look plainer," that's a decoration problem to solve
  with layout/type/color — not with an icon.

**Check:** for every icon usage, name in one sentence what it communicates
that the surrounding text/color/position doesn't. If the only honest
answer is "it looked incomplete without one," it's decorative and should
be cut, not kept for "visual balance." Also grep for `lucide-react` or
`@phosphor-icons/react` outside `src/lib/icons.tsx` — any hit is a
violation. Grep for a given action's icon (e.g. `X` for remove/close) and
confirm every screen using that action uses the same one.

---

## 15. Component Consistency

The same kind of element should look and behave the same way everywhere it
appears, independent of which screen or file it was built in. This is a
different failure mode from Section 3's rounding-consistency rule (one
property, applied unevenly) — this is the same *component* drifting into
several slightly different implementations because nobody reused the first
one.

**A concrete instance already in this codebase:** the status-dot pattern
from Section 10 (small colored dot + plain-weight label) is consistently
*designed*, but not consistently *sized* — `h-1.5 w-1.5`, `h-2 w-2`, and
`h-2.5 w-2.5` all show up as "the" status dot across different files, with
no stated reason one context gets a bigger dot than another. The pattern is
right; the repeated-by-hand execution of it drifted. The fix isn't a rule
that didn't exist — Section 10 already states the pattern — it's actually
extracting it into one shared piece so every consumer gets the same size for
free instead of re-guessing it.

- Before adding a new instance of a pattern that already exists elsewhere
  (a badge, a status dot, a pill button, an empty state), check how it's
  already built somewhere else in the app and match it — or extract a
  shared component if a third near-duplicate is about to get created.
- A semantic action (remove, save, cancel, expand) should use the same
  icon, the same label wording, and roughly the same control shape on every
  screen that has it — not "Cancel" in one place and "Discard" in another
  for the same action.

**Check:** pick a pattern that recurs across screens (a status dot, a
destructive action button, an empty state) and diff its actual class list
between two unrelated files. Any unexplained difference is drift, not a
deliberate per-screen decision.

**Decided: component primitives are Ark UI, not shadcn/Radix**, styled
once with custom CSS rather than an opinionated pre-built theme (prototyped
across both surfaces at `/design-preview`). Concrete decisions, each
recorded with the alternatives it beat:

| Primitive | Decision | Why |
|---|---|---|
| Tabs | **Underline** indicator | Correction: an earlier pass claimed this matched a "line" variant already in production — false, re-verified directly, every real Tabs usage renders shadcn's default segmented-pill style and the line variant has zero production usage. Underline was re-confirmed anyway (lower visual noise) with that premise corrected — it's a real visual change to `tenant-settings.tsx`, `meetings/page.tsx`, and `user-management.tsx`'s hand-rolled switcher, not a no-op port. Beat segmented-pill (what's actually live today) and top-accent-border. |
| Text inputs | **Bordered + filled** (full border, `bg-input`) | Initially ported the shadcn default as-is (bordered, `bg-transparent`, `shadow-xs`) without independent evaluation. Corrected 2026-06-30: `bg-transparent` left light-mode inputs separated from their surface by border alone, which Section 3 argues against ("prefer fill-color contrast over shadow"); `shadow-xs` is a resting-element shadow Section 3 also reserves for true overlays only. Fix: `bg-input` (the existing `--input` token, already used correctly in dark mode via `dark:bg-input/30`, just never extended to light) replaces `bg-transparent`, and `shadow-xs` is dropped — matching the precedent already set when Card's `shadow-sm` was removed. Beat filled-surface (i.e. `bg-muted`, no border) and underline-only. |
| Select (replaces all 7 native `<select>`s) | **Ark Select everywhere**, including the kiosk | One consistent custom-styled dropdown on every surface beats relying on the OS picker on touch — accepted the trade-off of losing the native touch picker for visual consistency. |
| Dropdown/kebab menus (replaces 3 ad hoc implementations) | **Ark Menu**, one shared primitive | Was hand-rolled three separate times with no shared keyboard/focus handling; one primitive styled once matches the Dialog/Tabs/Select approach. |
| Dialog | Ark Dialog | Already prototyped; styled per Section 3's heavy-uniform radius, shadow reserved for this overlay. |
| Status badges | No primitive — plain dot + label | Already specified in Section 10; doesn't need Ark, just the shared CSS class. |

Migration of the live app's `src/components/ui/*.tsx` (currently shadcn/Radix)
to these is not yet started — this is a decision record only.

---

## 17. Do Not Use

The canonical list. These are named because they're the empirically
most-flagged "this looks AI-made" patterns (sourced from large-scale
analysis of what people actually call out as AI tells, not opinion).
Extend it as you encounter more — don't strike an entry just because
it's inconvenient in the moment.

- **Violet/indigo/purple (`#6366f1`, `#7c3aed`, and the Tailwind
  indigo/violet/purple/fuchsia 400-800 range) as a primary brand color**
  — it's the framework default; using it reads as "nobody chose this."
- **Purple-to-blue/pink gradients**, anywhere — buttons, headers, text.
- **Gradient-filled text** (`bg-clip-text text-transparent` /
  `background-clip: text`) on headings or body copy.
- **The "tasteful default" palette**: cream/beige background (e.g.
  `#faf8f5`, `#f5f1e8`) + serif display font (Instrument Serif,
  Fraunces, Playfair Display, Cormorant, Spectral) + desaturated sage
  green. The newer tell — what generic output reaches for when trying
  to look "refined" instead of "techy." Just as recognizable as AI
  purple.
- **Untouched shadcn/Tailwind defaults as a pattern**: `rounded-lg
  border bg-card text-card-foreground shadow-sm` left unmodified, or
  stock `slate`/`zinc`/`gray`/`neutral`/`stone` with no further
  decisions on top. (Using the tools is fine — see Non-Tells. Using
  them with zero customization is the problem.)
- **The centered-hero-then-three-feature-card grid skeleton**
  (`grid-cols-1 md:grid-cols-3` directly under a centered hero) — the
  single most recognizable layout tell.
- **Large rounding used inconsistently** — some surfaces heavily
  rounded, others sharp or lightly rounded, with no stated logic tying
  the choice together. (This product's house style, per Section 3, IS
  heavy/near-uniform rounding — the tell is *inconsistency without a
  stated reason*, not heavy rounding itself once it's been deliberately
  adopted everywhere.)
- **Unprompted neon glow** — colored `box-shadow`/`text-shadow` blur on
  dark-mode headings or buttons that wasn't a deliberate design call.
- **Emoji used as functional icons** or section bullets, instead of a
  real icon set.
- **Boilerplate scroll/hover animation** with no communicative purpose:
  fade-in-on-scroll, scale-up-on-hover, scroll-jacking.
- **Generated marketing copy clichés**: "Transform your X,"
  "Supercharge," "Unleash," "Effortlessly," "reimagined,"
  "game-changer," "take your X to the next level."
- **Generic stock/blob illustrations** (undraw-style) instead of real
  product screenshots or commissioned art.
- **Glassmorphism/backdrop-blur used decoratively** rather than
  structurally (a fixed header that needs to stay legible over
  scrolling content is structural; blur for its own sake is not).
- **Redundant elements that say the same thing twice** — an icon+label
  pair where the icon adds no information beyond the label, a heading that
  restates the section it's already inside, a "0 results" empty state that
  repeats the filter text already visible above it. If covering one of the
  two leaves no information lost, one of them is decoration.
- **Stacking more than one decorative effect on the same element** without
  a specific reason for each — blur + gradient + shadow + glow-ring all on
  one card reads as "tried every effect," not as a considered choice. Each
  effect used elsewhere in this doc (shadow in Section 3, blur in the
  glassmorphism bullet above) is fine on its own, applied for the reason
  stated where it's introduced; the tell is several of them compounding on
  one surface with no individual justification.
- **Hover-only feedback** — any interactive treatment defined only on
  `:hover` with no active/press equivalent. This product runs on
  touchscreen kiosks with no pointer; hover-only feedback is invisible
  in practice and risks the "stuck hover" bug on touch browsers.
- **Identical container chrome for every tile in a modular grid**,
  regardless of what each one actually contains ("bento overload" —
  every widget crammed into the same bordered rounded box). The tell
  isn't the grid itself (see Non-Tells) — it's treating "card with a
  border" as the mandatory default presentation for every tile instead
  of letting content drive it. An ambient/glanceable widget (a clock,
  a quote) doesn't need the same boxed treatment as a dense, scrollable
  one (a task list) just because they're both rectangles in a grid.

### Non-Tells — do not flag these as slop

Don't over-correct into banning ordinary modern design: mesh/blob
gradient backgrounds used deliberately, dark mode itself, and
shadcn/Tailwind as tools. **A grid of varying-sized tiles is also fine
on its own** — it's a legitimate, common pattern for an actual data
dashboard, not a tell by itself. What *is* a tell is uniform,
undifferentiated box styling applied to every tile in that grid
regardless of content (see the Do Not Use entry above) — a more
specific claim than "bento grids are bad."

---

## Automated Scanning

`scripts/devibe-scan.py` mechanically greps the codebase for the
regex-detectable subset of the Do Not Use list and reports file:line
findings with a severity-weighted "vibe score":

```
npm run design:scan
```

It can't see layout coherence, spacing consistency, or whether a
flagged color is being used semantically (amber for a "high priority"
badge is fine; amber as an unconsidered accent default is not) — that
judgment still requires a human look. Treat its output as a worklist to
triage, not ground truth to blindly fix.

---

## Testing Protocol

Validate against one isolated component first — e.g. a single button in
its rest/active-press/disabled states — before generating a full
screen. Catching a wrong choice on one component is cheap; catching it
after it's been copied across twenty is not.

For any Earned Delight instance (Section 20): confirm the flourish fires
only on its stated trigger, not on every render, mount, or reload of the
same screen; confirm it doesn't reappear a second time for the same
underlying event (e.g. re-opening the widget after the day's tasks are
already all complete shouldn't replay it); confirm the next real action
is reachable immediately, not gated behind the flourish finishing.

---

## Behavior Rules

**DO:**
- Reuse an existing token/class before introducing a new size, color,
  or spacing value. A new value is a decision; it needs a reason.
- Build hierarchy with layout primitives (size, weight, position,
  space) before reaching for color.

**DON'T:**
- Don't apply a gradient, blur effect, or drop shadow without being
  able to state in one sentence what it's communicating.
- Don't introduce a second typeface, an off-scale font size, or an
  off-grid spacing value to "make something stand out" — earn it
  through hierarchy (Section 7), not by breaking the system.
- Don't treat dark mode as light mode with colors flipped.
- Don't let two elements on the same screen both claim to be "the
  primary action."
- Don't design feedback that only exists on `:hover` — this is a
  touchscreen kiosk product with no pointer device. Use active/press
  states instead (Section 6).
- Don't add an Earned Delight flourish (Section 20) without a named
  trigger and a named effect agreed before building it, and don't let
  one that's already shipped for a rare event quietly start firing on
  routine occurrences of the same interaction — that's delight
  inflation, the Section-20-specific case of the boilerplate-animation
  entry above.

---

## Changelog

- `[DATE]` — initial principles-based structure drafted.
- 2026-06-26 — added touchscreen-kiosk input model: no hover states,
  feedback must use active/press instead (Section 6, Section 9, Do Not
  Use, Behavior Rules, Testing Protocol).
- 2026-06-26 — adopted heavy, near-uniform corner radius as a
  deliberate house style (flat-design direction); revised Section 3 and
  the rounding entry in Do Not Use to distinguish "heavy rounding,
  stated and applied consistently" from "heavy rounding, unconsidered
  and inconsistent."
- 2026-06-26 — replaced unstated indigo (used across the remote
  mirroring/viewing feature with no actual decision behind it) with a
  deliberate `--hub-teal` token; added the claimed-semantic-colors
  table to Section 2.
- 2026-06-26 — added a stated exception to the uniform-radius rule for
  dashboard grid widgets: tight bottom-right corner marking the resize
  handle, modeled on the chat bubble's directional pinched corner.
  Scoped to widgets only.
- 2026-06-26 — rebuilt the dashboard header: real HubMark logo (was the
  generic letter-in-a-box placeholder), unified radius, removed resting
  shadows from `.pill`/widget cards in favor of flat fill-contrast,
  demoted passive status (clock, sign-out) below action controls, and
  calmed the settings-cog reveal. Renamed `glass-pill` -> `.pill` and
  deleted the unused `.glass-header` rule — both were leftover naming
  from an abandoned liquid-glass redesign attempt; also caught real CSS
  `:hover` rules in that class the earlier Tailwind-only hover sweeps
  had missed.
- 2026-06-26 — added Sections 11-13 (data drives the UI, progressive
  disclosure & spectrum of explicitness, UI is what you can't see),
  sourced from a second design-principles video. Identified a concrete
  instance of Section 13's problem already in this codebase: 13
  icon-only controls relying solely on the hover-triggered native
  `title` attribute for explanation, which doesn't function on a
  touchscreen kiosk.
- 2026-06-26 — built IconTip (touch-compatible tooltip) and applied it
  to all 13 controls flagged above; fixed the settings-cog's
  progressive-disclosure structure (Tidy/Reset moved to an overflow,
  theme pulled out into its own header button); deleted GridControls
  (a second, zero-consumer near-duplicate of SettingsPanel). Added the
  pill-is-a-signifier rule to Section 6 and the layout-prop sibling-
  resize warning to Section 9, after removing the brand/identity
  block's pill wrapper and the spring `layout` animations on the
  dashboard header that were causing it to visibly stretch whenever an
  unrelated sibling (the clock, the settings panel) changed.
- 2026-06-26 — differentiated dashboard widget chrome by role (Clock
  and Quote go borderless/ambient in normal view; Tasks, Calendar,
  Messages, and Forms keep the card boundary they actually need) after
  finding the "every widget gets identical rounded-box chrome"
  bento-overload pattern, sourced from umamii.design's 8 AI-slop
  signals. Removed the quote widget's purple-sparkle-in-a-box icon —
  a scanner blind spot (it used a CSS variable, not a Tailwind class,
  so devibe-scan.py's regex never caught it) and the same cliché
  pattern already identified in the dead motivational-quote.tsx.
  Corrected the Non-Tells section, which previously contradicted this
  finding by blanket-exempting "bento-grid layouts" — the grid pattern
  itself isn't the tell, uniform undifferentiated box styling within
  it is, which is a narrower and more accurate claim.
- 2026-06-26 — fixed "One Safe Font": replaced Inter-for-everything
  (including a faked monospace via `tabular-nums`) with two deliberate
  typefaces — Manrope for UI text, Space Mono for the clock/PIN/
  session-code displays that are actually tabular. Both self-hosted as
  static `.woff2` via `next/font/local`, same pattern as the previous
  Inter setup. Revised Section 1 from "one typeface" to state the
  two-typeface, distinct-job rule explicitly.
- 2026-06-26 — finished the settings-cog fix Section 12 already
  diagnosed but only half-applied: layout switch + entry into editing
  (browsing-mode actions) now live in one bounded popover anchored to
  the cog, instead of pills sliding out into the header's flow.
  Add/Cancel/Save still stay inline while actively editing — those are
  primary actions a mid-edit user needs immediately, not secondary
  settings, so collapsing them into the popover too would be the wrong
  direction. Also reordered the header to group by category: passive
  status (clock, connection) together, then configuration (settings,
  theme), then exit (sign out) — was settings/theme/connection/sign-out,
  which split the status pair across the configuration group for no
  reason.
- 2026-06-26 — removed Tidy Up and Reset Layout from the edit-mode
  toolbar (unused, per direct user feedback) along with their overflow
  menu, which had no other contents once both were gone. Deleted the
  dead `compact()` gravity-compaction function it called from
  `grid-engine.ts`/`grid-context.tsx` rather than leaving an unused
  feature wired up behind a removed button.
- 2026-06-26 — removed the quote widget's expand button (per direct
  user feedback — fullscreening a one-line quote adds no function).
  It already shared the ambient/borderless treatment with the clock
  widget (`isAmbient` in `widget-container.tsx`); the expand-button
  condition previously only excluded the clock by name, so it missed
  this. Switched the condition to the existing `isAmbient` check
  instead of adding a second special case.
- 2026-06-26 — removed the three predefined grid layouts (Balanced,
  Focus, Overview) and the layout-picker list in the settings popover
  (per direct user feedback — too many decisions for what's mostly a
  one-time setup step). Every location now starts on a single
  `DEFAULT_LAYOUT` and customizes from there; the popover is just
  "Customize widgets" + "Reset dashboard to default." Deleted
  `selectCustom`/`CUSTOM_LAYOUT_ID`/the `customRef` preset-vs-custom
  bookkeeping in `grid-engine.ts`, since there's no longer a second
  layout to switch away from — `isCustom` still exists and still gates
  what gets persisted (an untouched default layout saves as `null`,
  matching prior behavior).
- 2026-06-26 — added Section 14 (Icons) and Section 15 (Component
  Consistency), prompted by a user-supplied checklist of topics to
  consider. Icons codifies the icon system that already existed in
  practice (`src/lib/icons.tsx` as the sole Phosphor import point,
  `duotone` as the default weight, no direct `lucide-react`/
  `@phosphor-icons/react` imports elsewhere — verified by grep before
  writing the section) rather than inventing a new rule. Component
  Consistency cites a real instance already in this codebase: the
  Section 10 status-dot pattern is consistently designed but
  inconsistently sized (`h-1.5 w-1.5`/`h-2 w-2`/`h-2.5 w-2.5` all used
  as "the" status dot with no stated reason). Also added a
  micro-interactions paragraph to Section 9, and two Do Not Use
  entries: redundant elements generalized beyond the existing
  icon+label bullet, and decorative-effect stacking. Skipped adding a
  standalone "Spacing" or "Interactive Feedback" section from that
  checklist — both are already covered by Sections 5/3 and 6/9
  respectively; a duplicate section would have fragmented existing,
  enforced rules rather than adding anything new. "User Flow" from the
  same checklist was deliberately deferred rather than added
  here — unlike the other topics, it doesn't reduce to a "grep for
  this" check without first auditing this app's actual flows, and
  writing it without that groundwork would have produced generic UX
  advice instead of a falsifiable rule.
- 2026-06-26 — did that audit and added Section 16 (User Flow),
  grounded in tracing login, signup, dashboard edit mode, task
  completion, remote view, connection loss, and forms/messages through
  the actual code rather than speculating. Found and named a real,
  still-open issue: `handleSave` in `grid-dashboard.tsx` has an empty
  `catch` block, so a failed layout save gives the user zero feedback.
  Also found that `connection-status.tsx`'s reconnect loop has no
  backoff or give-up. Separately found that the remote-view banner
  auto-starts a mirror/control session with no consent and gives
  location staff no way to end it themselves (`endSession` in
  `remote-view-banner.tsx` is defined but never wired to the UI) —
  raised this directly before writing anything down, since it's a
  product/trust question, not a style question; confirmed as
  intentional (ARL is a trusted internal role, not an outside party)
  and documented as a stated exception rather than a defect.
- 2026-06-26 — audited dashboard/page.tsx and login/page.tsx against
  this doc and fixed what didn't need the mobile redesign first:
  login's session-pairing code now uses `font-mono` (Section 1);
  login's three error banners moved from raw `red-50`/`red-600` to the
  `--destructive` token already used everywhere else (Section 2/15),
  which also makes them dark-mode-aware; login's "Connected/Offline"
  indicator was hardcoded `useState(true)` and never updated — wired
  to the real `isConnected` from `useSocket()` instead of quietly
  lying about connectivity; the dashboard ticker's one-off
  `bg-card/80 shadow-sm` pill became a flat `border + bg-card` surface
  matching `.pill`'s no-shadow-at-rest rule (Section 3); removed a
  dead `title` attribute left on the header theme button after it was
  already wrapped in `IconTip`. Sign Out's icon-only state below `sm`
  (no label, no `IconTip`) was deliberately left for the mobile
  redesign rather than patched here, since that screen is being
  rebuilt next.
- 2026-06-26 — built a dedicated mobile dashboard layout (sourced from
  a mobile-UI-principles video), replacing the 12x12 grid below 640px
  with a single vertical stack (`grid-mobile-stack.tsx`) instead of a
  shrunk copy of the same two-directional layout — added the
  reasoning to Section 4. Ambient widgets (clock, quote) render
  full-width inline; everything else is a tappable summary row that
  opens that widget's existing fullscreen presentation (tasks' own
  modal via the same `externalModalOpen` contract the desktop expand
  button uses, messages/forms via their existing overlay launchers, a
  small new generic fullscreen sheet for calendar/month). View + act
  only for v1 — the free-form drag/resize edit mode doesn't mean
  anything once every widget is forced full-width in one column, so
  `SettingsPanel` shows a note pointing to a larger screen instead of
  a "Customize widgets" entry on mobile; "Reset dashboard to default"
  stays available since it's meaningful at any width. Folded the
  audit's Sign Out finding into this: Theme and Sign Out move into
  `SettingsPanel`'s popover as labeled rows on mobile instead of
  separate header buttons, so Sign Out always has a visible label.
  Extracted `useDeviceType` (previously living inside
  `arl-dashboard-context.tsx`, ARL-only) to `src/hooks/use-device-type.ts`
  so the dashboard could reuse the same device-detection logic the ARL
  side already established, rather than writing a second one (Section
  15). Also extracted `isAmbientWidget()` into `grid-engine.ts` so the
  desktop grid and the new mobile stack agree on which widgets are
  ambient from one shared check instead of two copies of the same
  type comparison.
- 2026-06-26 — canonized a 4-size/2-weight type scale and an 8pt
  spacing grid (Sections 1 and 3), then ran the safe, mechanical part
  of a full-codebase retrofit immediately rather than letting the new
  rule and old code drift apart from day one:
  - `font-medium` and `font-bold` collapsed into `font-semibold`
    globally (421 instances, 79 files) — checked first that this was
    actually drift and not a real 3-tier hierarchy: the same size tier
    (`text-sm`, `text-xs`) had near-identical counts of `font-medium`
    and `font-semibold` doing the same job, with no consistent role
    separating them. `font-black` was audited and kept, but its stated
    exception is broader than originally proposed (not just numerals —
    also brand monograms and safety-critical alert headings, which is
    what it was actually already being used for).
  - Every arbitrary sub-12px font size (`text-[7px]` through
    `text-[11px]`, 575 instances, 82 files) collapsed to `text-xs` —
    mechanical and unambiguous since all of them were already below
    the new 12px floor regardless of context. `text-[15px]` (7
    instances, all in `onscreen-keyboard.tsx`, all the same shared
    constant) was kept as a stated exception rather than forced down
    to Body, since it's already a single deliberate, consistent
    choice for touch-keyboard legibility.
  - **Deliberately not done in this pass:** reassigning `text-base`
    (58 instances) and `text-xl` (28 instances) to the nearest real
    tier, and fixing the 395 true spacing violations (`gap-1.5`,
    `p-2.5`, etc.). Both need contextual judgment per instance — which
    tier a `text-base` should round to, which direction a `gap-1.5`
    should round — that a blind find-and-replace would get wrong as
    often as right. Scoped as a deliberate follow-up pass, file by
    file, rather than rushed alongside the safe part.
- 2026-06-27 — did the follow-up pass. `text-base`/`text-xl` (86
  instances, 29 files) reassigned by role: widget/section/modal titles
  to Title, page-level and full-screen-state headings to Display
  (dropping several `sm:text-2xl`-style responsive steps that were
  shrinking a heading specifically on mobile — the opposite of the
  font floor), list rows and secondary copy to Body, primary buttons
  to Title. Left alone with reasons: `text-base` on `<Input>`/
  `<Textarea>` (the documented 16px iOS-zoom floor, already correct),
  the on-screen keyboard's key/emoji-grid sizing (glyph rendering, not
  prose — same register as its existing 15px exception), isolated
  icon/emoji glyphs, and the `font-black` alert headings (already a
  documented exception, just at a size outside the prose scale on
  purpose).

  Then the 395 fine-grained spacing violations: sampled the two
  largest buckets first (`py-0.5`/`mt-0.5`, 82 of 112 instances at
  that tier) and found the same few recipes repeated almost verbatim
  everywhere — a badge's `px-1.5 py-0.5`, a caption's `mt-0.5` under a
  label — confirming these were consistent, low-risk patterns rather
  than bespoke pixel art needing individual review. Applied one stated
  rounding rule instead of auditing 395 instances by eye: round to the
  nearest accepted value, ties resolved toward the primary 8pt grid,
  with one named exception — `gap-1.5` (icon-to-label spacing) rounds
  down to `gap-1` instead of up, since an icon and its own label are
  the tightest possible grouping (Section 5), and the tie-break should
  follow that, not the generic default. Scoped the rule itself to
  rhythm (padding/margin/gap) and explicitly excluded position offsets
  and element dimensions, after noticing `-right-0.5`/`h-0.5`-style
  corner-overlap and hairline uses that have nothing to do with
  spacing rhythm.
- 2026-06-27 — mobile dashboard follow-ups from direct user feedback
  after using it:
  - Removed the "Customizing widgets needs a larger screen" note and
    the "Reset dashboard to default" entry from mobile entirely —
    `SettingsPanel` (Customize/Reset) now only renders on
    tablet/desktop. Reasoning surfaced and confirmed with the user:
    reset has no visible target if you can't see what's customized,
    so keeping it next to a removed Customize entry didn't make sense.
  - Redesigned the mobile header: Sign Out is its own header button
    (icon + `IconTip`, same pattern as the Theme button beside it),
    never folded into a popover — it's too consequential an action to
    bury a tap deeper than necessary. This also retires the
    theme/onSignOut props `SettingsPanel` had grown for the mobile
    case, since the cog no longer renders there at all.
  - Settings cog's `IconTip` no longer says "Close settings" when
    open — just "Settings"; the rotating icon already communicates
    state. Added click-outside-to-close (mousedown listener + a ref on
    the panel), matching the pattern `ConnectionStatus` already used,
    instead of requiring a second tap on the cog to dismiss.
  - Capitalized the Theme tooltip's value everywhere it appears
    (dashboard header, login page x2, the shared `ThemeToggle`
    component) — "Theme: dark" read like an internal enum value
    leaking into UI copy, not a sentence.
  - Today's Tasks fullscreen list: mobile now stacks the due time
    above the task title instead of a fixed-width time column beside
    it. The inline layout left ~123px for the title on a phone
    (time column + gap + action icon ate the rest first), truncating
    anything longer than a few words. Desktop/tablet keep the compact
    inline row since there's room there.
  - Mobile stack now always renders the quote widget last, regardless
    of its grid position on desktop — it's the lowest-priority,
    most-glanceable item and belongs at the bottom of the list, not
    wherever desktop happened to place it.
  - `DEFAULT_LAYOUT` (`layouts.ts`) now tiles the entire 12x12 grid
    with no empty rows — the previous default left the bottom 3 rows
    (25% of the grid) empty. Added Forms and Quote stacked under
    Messages in the left column and extended Calendar to fill the
    rest of the right column: 4x3+8x6+4x3+4x3+4x3+8x6 = 144 cells,
    exactly `GRID_COLS*GRID_ROWS`, a complete gapless tiling.
- 2026-06-27 — widget header consistency and breathing room, per
  direct user feedback after looking at the dashboard: some widgets
  had a real icon+title header (Messages, Upcoming), one had a bare
  nav bar with no identity (Calendar/month), and one had no header at
  all (Tasks — just the completion ring, which doesn't say "this is
  tasks" on its own). Forms was a single full-bleed button with its
  label inside the tap target instead of a header.

  Standardized every data widget on one header: icon + `text-lg
  font-semibold` title, `px-3 pb-2 pt-3`. Ambient widgets (clock,
  quote) still get none, per the original Section 14/Non-Tells
  reasoning — a header would be redundant chrome on something
  meant to be glanced at, not browsed. Specifically:
  - Tasks: added the missing header (icon `CheckSquare` + "Today's
    Tasks") above the completion ring.
  - Calendar/month: folded an icon into the existing month-name/nav
    row rather than stacking a separate title row above it — the
    month name itself is more useful here than a static "Calendar"
    label, and a second row would have been the exact double-header
    redundancy being fixed elsewhere.
  - Forms (`LauncherTile`): added the header, removed the now-
    redundant label paragraph from inside the tap target (the title
    was about to appear twice — once in the new header, once in the
    body — so the body keeps only the icon and hint).
  - Upcoming's header used a different technique to get the same
    spacing (`mb-2` on the wrapper vs. `pb-2` inline like the other
    four) — switched it to match; same visual result, one fewer way
    of doing the identical thing.

  Then widened the breathing room: grid gap and outer page padding
  both went `gap-3`/`p-3` (12px) -> `gap-4`/`p-4` (16px) in
  `GridSurface` and the mobile stack, and widget-interior list/content
  padding that was sitting at `px-2`/`py-2` (8px) — tighter than the
  gap *between* cards, which had it backwards — moved to `px-3`/`py-3`
  (12px) across Messages, Upcoming, Tasks' pending list, and
  Calendar's day-grid. Clock's padding (`p-3`) was bumped to `p-4` to
  match Quote, the other ambient widget, which was already there.
  Net effect: a card's interior now reads as more spacious than the
  gap separating it from its neighbors, not less.
- 2026-06-27 — resolved why the dashboard header's four controls had
  two different chrome styles (Connection Status/Settings get the
  `.pill` background, Theme/Sign Out don't), prompted by the user
  directly asking whether that was an oversight worth making uniform.
  It wasn't arbitrary, but it also wasn't stated anywhere, which is
  why it looked like drift: Connection Status and Settings are
  disclosure controls (tapping opens a panel); Theme and Sign Out are
  direct, momentary actions (tapping completes the whole interaction).
  A closed door to more UI earns a visible container; a verb doesn't.
  Rejected the user's first alternative (a "transparent pill" on
  Theme/Sign Out) on inspection — a pill with no fill and no border is
  pixel-identical to no pill at all, so it wouldn't have changed
  anything, just added inert markup describing the status quo.

  Stated the rule explicitly in Section 6 (it was previously folded
  into the broader "passive content shouldn't get a pill" point, which
  is true but not the same claim — that one's about passive vs.
  tappable, this one is about tappable-and-opens-a-panel vs. tappable-
  and-just-acts). Fixed the `.pill` CSS comment in `globals.css`,
  which had drifted out of sync with the rule it was supposed to
  describe: it listed "clock" and "sign-out" as example pill use cases,
  but neither has ever actually used `.pill` — clock is passive status
  (correctly excluded already, per the existing rule), sign-out is a
  direct action (now correctly excluded per the new one). Also split
  the header into two visually grouped clusters (disclosure controls,
  then a wider gap, then direct actions) so the grouping is legible
  from spacing alone, not only from which ones happen to have a
  container — the same squint-test Section 5 already asks for, applied
  to a toolbar instead of a list.
- 2026-06-27 — built real routes for Tasks and Messages, and rebuilt
  Calendar, so "widget" means what the term actually implies (Section
  16): quick access to a full version that exists somewhere, not a
  modal standing in for one. A sidebar nav was considered and
  explicitly rejected first — see Section 16 — in favor of widgets as
  launchers plus a slim shared sub-page header.
  - Extracted `taskApplies`/`buildWeeks`/`CalTask`/`PRIORITY_DOT` out
    of `grid-calendar.tsx` into `src/lib/task-calendar.ts` so the
    widget and the new route can't drift the way the *old* `/calendar`
    page already had — it had its own separate, never-reconciled copy
    of this logic (missing the `createdAt` cutoff check, a different
    and buggy biweekly calculation, no `showInCalendar` filter), which
    is exactly why it showed different tasks than the widget for the
    same day. Exported `CalendarModal` (was file-local) so `/calendar`
    renders the identical month-grid + selected-day-list layout the
    widget's modal already used, instead of a third implementation.
    Found and fixed a raw 📅 emoji used as an icon in that modal's
    empty state while in there — a scanner blind spot (emoji inside
    JSX text, not a Tailwind class), same category of miss as the
    purple-sparkle find earlier.
  - `/tasks`: the widget's modal already covers "today" well by
    design; the gap was multi-day browsing, history, and filtering by
    type/priority, which the modal deliberately doesn't do. Built on
    the existing `/api/tasks` + `/api/tasks/completions` +
    `/api/tasks/complete`/`uncomplete` endpoints — no new API needed,
    since `localDate` on those was already arbitrary-date-capable.
  - `/messages`: macOS-Messages-style two-pane (thread list always
    visible, active thread beside it). Stated v1 scope — see Section
    16 for what's deferred and why (RestaurantChat's 1100+ lines of
    voice/reactions/mentions/group-creation/search/mute are tightly
    coupled to its own overlay UI; replicating all of it in this pass
    would have been a bigger, riskier change than the route needed to
    be useful).
  - Removed `GridTasksWidget`'s internal fullscreen modal and
    `GridCalendarWidget`'s internal modal entirely (not left dead
    behind a removed trigger) — both now navigate. `onUncomplete` came
    out of `GridTasksWidget`'s props with it, since undo only existed
    inside the removed modal; `/tasks` has its own complete/uncomplete
    that isn't scoped to today only.
  - Built `use-inactivity-redirect.ts` + `InactivityWarning`, mounted
    once inside the new shared `SubPageHeader` (so every sub-page gets
    it automatically) — kiosk/desktop only, with a visible countdown
    and cancel-on-any-tap rather than a silent redirect. See Section
    16 for why this is a stated mitigation for a real risk routing
    introduced, not a nice-to-have.
- 2026-06-27 — made each widget's own header (icon + title, added a
  few sessions back for identity) the tap target for "go to the full
  version," replacing the floating corner Expand button — a bigger,
  more consistent touch target, and it removed real redundancy (Tasks
  had the header, the completion ring, *and* the corner icon all doing
  the same job). Considered an onboarding tooltip to teach the gesture
  (direct user question) and recommended against it: a chevron-right
  at the end of each header is a self-evident, permanent signifier
  that costs one icon, versus building and maintaining "don't show
  again" state for something the chevron solves outright — consistent
  with this project's standing preference for a real visible signifier
  over teaching an invisible interaction (the same reasoning that
  replaced `title` tooltips with `IconTip`, and that scopes `.pill` to
  disclosure controls specifically).

  Removing the corner Expand button made the entire underlying
  expand/collapse mechanism in `WidgetContainer` — `expandedWidget`,
  `toggleExpand`, `isExpanded`, the fullscreen-card backdrop and
  Collapse button — completely unreachable: it was the *only* caller
  that ever set a widget's expanded state to true. Removed all of it
  from `widget-container.tsx`, `grid-engine.ts`, and `grid-context.tsx`
  rather than leave a dead state machine behind a removed button, the
  same standard applied earlier today to Tasks' and Calendar's removed
  modals.
- 2026-06-27 — follow-up fixes after using the new `/tasks`, `/messages`,
  `/calendar` routes:
  - **All icons now one weight.** `src/lib/icons.tsx`'s wrapper helper
    (renamed `duotone` → `bold`) now forces `weight="bold"` on every
    icon instead of `"duotone"`; the three icons that bypassed the
    wrapper entirely (`Plus`, `X`, `XIcon`, defaulting to Phosphor's
    "regular") were wrapped too. One weight app-wide, not a per-icon
    judgment call — mixing duotone and regular was unintentional drift,
    not a deliberate register split (unlike the font-weight exception
    in Section 1, which *is* deliberate).
  - **The three new routes were missing the actual app header** —
    they had their own slimmer `SubPageHeader` (logo-less, no clock/
    theme/sign-out) instead of the same chrome `/dashboard` uses, which
    made leaving the dashboard feel like leaving the app. Replaced both
    with one shared `src/components/app-header.tsx`: the dashboard's
    logo+username block is swapped for a back-arrow+page-icon+title
    when a `backHref` prop is passed, but the clock, `ConnectionStatus`,
    theme toggle, and Sign Out are now identical on every full-page
    route. The widget-customize cog stays dashboard-only (it needs a
    `GridProvider`, which only wraps the dashboard) via a
    `settingsSlot` prop rather than being hardcoded into the shared
    header. `SubPageHeader` is deleted — one header implementation, not
    two that can drift.
  - **Fixed a real bug: tasks could be marked complete/incomplete on
    days they shouldn't be able to.** `/api/tasks/complete` already
    blocked completing a *future* day unless the task allows early
    completion, but had no floor — a past day (already missed) could
    still be marked complete after the fact, which doesn't make sense
    for a recurring daily/weekly task: a missed day is supposed to stay
    missed, not be rewritten retroactively. Added the same floor to
    `/api/tasks/uncomplete`. The `/tasks` page UI now reflects this
    instead of offering a control that would just 403: the complete
    toggle only renders for today or an early-completable future day;
    past days show a static read-only status (missed/done) instead.
  - **Redesigned `/tasks`' list** — it filtered by priority and type
    but never showed either on a task, and used a single
    `max-w-2xl`-capped column that left most of a desktop screen blank.
    Replaced with a responsive card grid (1/2/3 columns by breakpoint)
    where each task shows its type and priority as badges, plus a
    completed/total count for the selected day in the filter bar.
- 2026-06-27 — quote widget redesigned as a stated exception, not a
  precedent. User-requested: outline border (same shape as every other
  widget) but no fill, plus a large watermark quotation mark and
  italic serif type behind/around the text. Agreed this is fine to
  break the "no decoration without a job" rule for, on purpose, for
  exactly one reason: this widget has no job — it's the dashboard's
  only purely editorial surface, not a data widget being dressed up.
  That reasoning doesn't transfer to Tasks/Messages/Calendar/Forms,
  which all have real content competing for attention; a watermark
  glyph there would be the actual AI-slop tell this project has spent
  this whole pass removing. Kept deliberately restrained (one
  low-opacity monochrome glyph, no gradient, no drop shadow) so the
  exception doesn't become its own slop.

  Mechanically: added `isOutlineWidget()` next to `isAmbientWidget()`
  in `grid-engine.ts` (quote moved out of the ambient bucket — it now
  always renders the standard card border, just without `bg-card`
  filled in, falling back to filled while editing/dragging like the
  ambient widgets already did, for grab visibility). Added `Quotes`
  to `src/lib/icons.tsx`'s Phosphor wrapper for the background glyph.
- 2026-06-28 — added Section 18 (Redundancy & Earned Presence), prompted
  by a direct question about whether "AI-generated UI bloat" deserved
  its own principle. Defined against concrete instances found the same
  day during the ARL Overview audit: the "🟢 Live" label restating what
  `live-activity-feed.tsx`'s real-time updates already demonstrate, and
  the global task-completion toast (`arl/layout.tsx`) duplicating the
  same event the Overview page's activity feed already shows — both
  well-built individually, both unnecessary together. Stated two checks
  ("already said it," "genre default") rather than a single vague
  "avoid bloat" rule, matching this doc's existing falsifiable-check
  convention.
- 2026-06-30 — extended Section 16 (User Flow) and Section 11 (Data
  Drives the UI) after reviewing four external UX articles for gaps.
  Deliberately did not adopt their content directly — most of it
  duplicated existing sections (hover/active states, motion timing,
  destructive-action confirmation) and one recommendation (reveal
  per-row table actions on hover) directly conflicts with this doc's
  no-hover model and was rejected rather than imported. Before writing
  anything, ran an audit for real instances in this codebase, per this
  doc's own standing rule of citing found defects rather than asserting
  generic advice — a third candidate (in-context format hints on
  focused inputs) didn't turn up a real gap and was dropped rather than
  added anyway. Section 16's two-part flow rule ("knows what just
  happened," "knows how to get back") became three parts, adding "knows
  something is happening right now," grounded in real findings:
  `task-form-modal.tsx`'s and `forms-repository.tsx`'s save/delete
  buttons firing twice on a fast double-tap with no in-flight state, and
  `dashboard/page.tsx`'s task-completion checkbox — the single most-used
  control on the kiosk surface — silently reverting on a failed request
  with no error shown anywhere. Section 11 gained a table-structure
  paragraph that explicitly routes per-row action disclosure through
  Section 12's existing tap-not-hover rule rather than treating tables
  as a hover-pattern exception to it.

  Restructured the whole document into Section 0 (a universal gate)
  followed by two explicit parts — Part A (UX: Sections 11, 12, 13, 16,
  18) and Part B (UI: Sections 1-10, 14, 15, 17) — prompted by a direct
  question about whether DESIGN.md treats UX and UI as independent
  layers (it didn't; everything was one flat interleaved list) and
  whether UX should drive UI (yes — confirmed against Section 0's own
  4th decision, "layout intent," which already gated a UI choice behind
  a UX question without saying so explicitly). Section numbers were
  deliberately kept stable through the reorganization — both ARL audit
  docs cite them directly (`§11`, `Section 7`, etc.), and renumbering to
  match the new physical order would have silently broken every one of
  those citations for no benefit. Verified line-for-line before and
  after that no existing content was dropped or altered, only
  relocated, connective part-headers added, and Section 18 introduced.
- 2026-06-30 — corrected Input/Textarea's background and shadow,
  prompted by a direct question about whether the transparent background
  and visible box-shadow on bordered fields were ever a considered
  choice (they weren't — both were inherited unmodified from shadcn's
  default and the Section 15 decision table's own wording said so:
  "ports as-is"). `bg-transparent` meant light-mode fields were
  separated from their surface by border alone, the opposite of Section
  3's stated preference for fill-color contrast over shadow; `shadow-xs`
  is a resting-element shadow, which Section 3 reserves for true
  overlays only — the same issue already found and fixed for Card's
  `shadow-sm` earlier this pass, just not revisited for its sibling
  form controls. Fix: both now use `bg-input` (the existing `--input`
  token — `#e2e8f0` light / `#2e2e2e` dark — already applied correctly
  in dark mode via `dark:bg-input/30`, just never extended to light)
  and drop `shadow-xs` entirely. Select's trigger was checked too and
  found already correct (`bg-background`, no shadow) — not touched.
- 2026-06-30 — found and fixed three real defects via direct visual
  inspection of the ARL console and kiosk dashboard, the same session
  Dialog/Card adoption was completed in:
  - **Dialog's z-index never accounted for this app's actual stacking
    scale.** It shipped at shadcn's stock `z-50`; the app's real top-tier
    overlay convention (`confirm-dialog.tsx`, the emergency overlay, the
    onscreen keyboard, error-boundary) clusters at `z-[9997]`-
    `z-[10000]`. `z-50` sat below the ARL header (`z-[100]`) and its
    mobile nav overlay (`z-[140]`), so a dialog's backdrop visibly
    stopped short of the header (header stayed undimmed) and a tall
    dialog's content could be covered by it. Bumped to `z-[9999]`,
    matching `confirm-dialog.tsx` exactly. Select and Menu had the same
    `z-50` problem and are routinely used *inside* Dialog — bumped both
    to `z-[10000]` so they render above any Dialog that contains them.
  - **Dialog's background was the wrong elevation tier** — `bg-background`
    (the base/page tier) instead of `bg-card`, backward from Section 8's
    model ("base darkest, cards lighter, modals lighter still"). A modal
    rendered at the same color as the page behind it, actually darker
    than the cards it floated above in dark mode. Menu already correctly
    uses `bg-card`, Select's dropdown uses `bg-popover` (same value) —
    Dialog was the one outlier, presumably missed because it was the
    last of the three Ark overlay primitives styled.
  - **A virtualized table's header and rows silently disagreed on column
    width.** `task-virtual-list.tsx`'s header row and each task row are
    separate CSS Grid containers (the row virtualizer absolutely
    positions rows, so they can't share one grid) — the Actions column
    used `auto` width, which resolves independently per grid. The
    header's "Actions" text is narrower than a row's three real icon
    buttons, so the two grids disagreed on column 3's width, visibly
    shifting the fixed 220px Schedule column out of alignment between
    header and rows. Fixed width instead of auto resolves it for every
    grid identically, regardless of content — the general lesson:
    `auto`-sized columns are unsafe across any two elements that aren't
    provably the same grid container, virtualized or not.
  - **The new `/messages` route shipped with no onscreen-keyboard
    wiring at all** — a plain `<input>`, while the older dashboard chat
    overlay (`restaurant-chat.tsx`) already has the keyboard toggle
    correctly. On a kiosk with no physical keyboard this meant a user
    navigating to `/messages` had no way to type. A reminder that a new
    route replicating an existing surface's *layout* doesn't
    automatically replicate its kiosk-specific *input affordances* —
    each needs to be checked against Section 6's no-pointer-input
    premise independently, not assumed inherited.
- 2026-06-30 — fixed inconsistent radius values inside the dashboard
  grid widgets (`src/components/dashboard/grid/`), the exact
  no-stated-logic pattern Section 3's Do Not Use entry warns about.
  The outer widget card frame's pinched bottom-right corner (Section 3's
  stated exception) was already correct; the drift was in peer elements
  *inside* that frame — icon-avatar boxes used `rounded-lg`/`rounded-2xl`
  interchangeably for the same role (`grid-upcoming.tsx`,
  `widget-renderer.tsx`, `grid-mobile-stack.tsx`) instead of the
  `rounded-xl` every icon box elsewhere in the app already uses; the
  remove-widget button used `rounded-md` instead of the `rounded-lg`
  `DestructiveIconButton`/`ModalCloseButton` convention; the widget-size
  badge ("3×2") used bare `rounded` instead of `rounded-full` like the
  shared `Badge` component and every other small text chip; and the
  compact mini-calendar's day cell used `rounded-lg` while the identical
  full-calendar-modal day cell two hundred lines below it used
  `rounded-xl`. All converged onto the values already established
  elsewhere in the app rather than picking new ones.
- 2026-06-30 — swept the codebase for Section 6's stated violation
  ("any `hover:` class with no corresponding active/press treatment")
  and paired every found instance with an `active:` equivalent, across
  `confirm-dialog.tsx`, `notification-panel.tsx`, `notification-bell.tsx`,
  `live-activity-feed.tsx`, `voice-recorder.tsx`,
  `emoji-quick-replies.tsx`, `error-boundary.tsx`, `global-search.tsx`,
  and the meeting-room surface (`meeting-room-livekit-custom.tsx`,
  `meeting-room/controls-bar.tsx`, `chat-panel.tsx`, `qa-panel.tsx`,
  `zoomable-video.tsx`) — `confirm-dialog.tsx` and the meeting-room
  controls bar were the highest-impact instances, since every
  destructive confirmation in the app and every mic/camera/end-call
  control in a live meeting previously gave zero visual feedback on an
  actual touchscreen tap. Two instances were a stronger bug than a
  missing pairing: `notification-panel.tsx`'s per-row dismiss buttons
  used `opacity-0 group-hover:opacity-100`, making them permanently
  invisible (not just unfeedback-ed) on touch — fixed by making them
  always visible, matching the "tap or an always-visible affordance,
  never hover reveal" rule already stated for disclosure elsewhere in
  this doc. `live-activity-feed.tsx`'s activity rows had a hover
  background despite having no `onClick` at all — a false affordance
  implying tappability that didn't exist — fixed by removing the hover
  styling rather than adding a meaningless active state.
  `meeting-room/chat-panel.tsx`'s send button also had a latent color
  bug from this: its custom `hover:bg-red-700` override left the
  shared `Button` component's own default-variant `active:bg-primary/90`
  in place underneath (different Tailwind state variants don't conflict
  via twMerge), so the button would have flashed primary-color on press
  instead of red — fixed by adding the matching `active:bg-red-700`
  override. Admin Console files (`admin/admin-sidebar.tsx`,
  `admin/confirm-with-pin-dialog.tsx`) and `landing-page.tsx` were
  deliberately left out of this pass — the former is a desk-only tool
  with no stated touch use case (per the Admin Console rebuild plan),
  the latter is a pre-login marketing page, neither sharing this
  product's kiosk premise; if either later gains a stated touch
  use case this should be revisited.
- 2026-06-30 — removed decorative `backdrop-blur-md` from the
  dashboard's two header dropdown menus (`grid-dashboard.tsx`'s "Add
  widget" and settings/cog popovers). Both already sat on a
  near-opaque `bg-card/95`, so the blur was doing almost nothing
  visually — and per Section 11's Do Not Use entry, these don't sit
  over actively scrolling content, so the blur was decorative, not
  structural (the structural case — a header staying legible over
  content scrolling beneath it — doesn't apply to a self-contained
  floating menu). Also inconsistent with this app's actual dropdown
  convention: the shared `Menu`/`Select` primitives both use a solid
  `bg-card`/`bg-popover` with no blur at all (`ui/menu.tsx`,
  `ui/select.tsx`) — these two were the only dropdowns in the app
  reaching for glassmorphism. Switched both to plain `bg-card` to
  match.
- 2026-06-30 — swept the rest of the app for the same decorative-blur
  pattern (prompted directly by "is there any glassmorphism left?").
  Audited every remaining `backdrop-blur` in the codebase against
  Section 11's structural-vs-decorative test. Left alone as genuinely
  structural: every full-screen modal backdrop (`confirm-dialog.tsx`,
  `admin/confirm-with-pin-dialog.tsx`, `global-search.tsx`,
  `inactivity-warning.tsx`, both `login/page.tsx` overlays) — Section
  3's "blur reserved for true overlays" rule; the style guide's own
  sticky header and `landing-page.tsx`'s sticky nav — legible-over-
  scrolling-content, the named structural exception; `arl/layout.tsx`'s
  route-transition loading skeleton — a light 2px blur tied to a real
  transitional state, not permanent decoration; `arl/layout.tsx`'s
  mobile bottom nav bar — same scrolling-content case as the sticky
  headers; and every meeting-room HUD badge (participant name tags,
  reaction bar, `broadcast-launcher.tsx`'s viewer count) — these float
  over a live, constantly-changing video feed, the closest analogue
  to "scrolling content" this app has. Found and fixed four real
  violations: `app/signup/page.tsx`'s step card was a textbook
  glassmorphism treatment (`bg-white/5` + `border-white/10` +
  `backdrop-blur-sm` on a dark gradient page) with nothing scrolling
  behind it — bumped the fill to `bg-white/10` and dropped the blur.
  `offline-indicator.tsx`'s toast and `meeting-room-livekit-custom.tsx`'s
  host-left banner both blurred a background that was already 90%
  opaque (the banner sits in normal document flow, not even layered
  over anything) — blur dropped, opacity unchanged, no visible
  difference. `remote/mirror-toolbar.tsx`'s collapsed pill stacked
  `backdrop-blur-xl` with a pulsing glow-ring *and* a shadow on one
  small element — almost the literal example Section 11's Do Not Use
  list gives for "stacking more than one decorative effect with no
  individual justification" — and its expanded toolbar paired
  `backdrop-blur-xl` with an already-95%-opaque `bg-card/95`; both
  dropped the blur, the expanded toolbar's fill bumped to fully solid
  `bg-card` to match the standard surface convention now that nothing
  needs blending into.
- 2026-06-30 — deleted two dead files: `src/lib/motion.ts` (shared
  Framer Motion timing constants) and `src/hooks/use-swr-fetch.ts`
  (a stale-while-revalidate fetch hook). Confirmed via grep that
  neither had a single importer anywhere in `src`, and neither was
  exported from a barrel file or referenced by a test — both were
  built but never adopted by the components they were meant for.
- 2026-06-30 — closed out DASHBOARD-AUDIT.md's last open finding (the
  full "container/control/circle" radius pass). Audited every
  `rounded-*` instance across all 25 live dashboard files role by
  role rather than just by raw distribution count — the six-scale
  spread the audit's scanner counted turned out to already be a
  mostly-coherent system once grouped by role (see the new radius
  table above), not unconsidered drift. Found and fixed the three
  real cross-file mismatches that remained: `grid-calendar.tsx`'s
  month-nav chevron and close buttons were `rounded-full` while the
  identical-role buttons on ARL's own calendar (`arl-calendar.tsx`)
  are `rounded-lg`; `grid-tasks.tsx`'s popover close button was
  `rounded-full p-1` instead of the same `rounded-lg` every other
  close/dismiss icon button in the app uses; `mirror-toolbar.tsx`'s
  collapse button was `rounded-xl` while its own sibling toggle
  buttons' icon-only counterparts elsewhere are `rounded-lg`. Documented
  the resulting tiers in Section 3 so future additions have something
  to check against instead of re-deriving the system from scratch.
- 2026-07-01 — added an icon-specific earned-presence check to Section
  14, prompted by a direct question: "do we have anything about
  overuse of icons?" The answer was that Section 18's generic
  earned-presence test ("does this element's absence lose the user
  anything?") already covered the principle, but nothing in the doc
  ever pointed it at icons specifically — Section 14 only had
  consistency rules (one library, same icon = same meaning, one size
  scale), never a should-this-icon-exist-at-all check. Added one,
  applying Section 18's test directly to icons with a concrete
  one-sentence check: name what the icon communicates that the
  surrounding text/color/position doesn't; if the only honest answer
  is "it looked incomplete without one," it's decorative and should be
  cut. A codebase audit against this new rule is the next pass.
- 2026-07-01 — ran that audit and fixed the highest-confidence
  findings. Two patterns:
  - **Section-header icons restating the heading text right next to
    them** — `meeting-analytics.tsx`'s `BarChart3` inside "Meeting
    Analytics", `notification-settings-panel.tsx`'s `Settings` inside
    "Notification Settings", `task-manager.tsx`'s `BookOpen` inside
    "Task Templates". Each icon sat directly beside a heading that
    already said the exact same thing in words — the literal case the
    new rule names.
  - **Per-row table-cell icons restating an exact-match column
    header** — `locations-manager.tsx`'s `MapPin`/`Mail`/`Monitor`
    icons repeated on every row of the Address/Email/User ID columns,
    where the column header already stated the field on every row at
    once. Removed from the table view; kept in the same file's mobile
    card view (no column headers exist there, so the icon is
    disambiguating a bare value, not restating an adjacent label) —
    except one instance (`Monitor` beside "User ID: {loc.userId}"),
    where the visible text label made it redundant there too.
  - **False positives caught before editing** — a sub-agent's initial
    pass over-flagged button icons (`Trash2` beside "Delete",
    `BookOpen` beside a "Templates" button) that the new rule
    explicitly protects (the rule's own example is "a trash icon next
    to 'Delete' is fine"), and flagged `arl-calendar.tsx`'s inline
    `Clock`/`Repeat` metadata icons despite there being no adjacent
    label for them to restate. Left `scheduled-meetings.tsx`'s stacked
    `Calendar`/`Clock`/`Globe`/`Lock` icons in one "Schedule" column as
    a deliberate non-fix — they disambiguate *between* several
    unlabeled lines stacked in one cell, which is different from
    restating a header that's already right there.
- 2026-07-01 — added Section 20 (Earned Delight), prompted by a direct
  challenge: does this doc's consistent anti-slop restraint read as
  sterile in aggregate, even where every individual rule is correct?
  Checked the history first rather than assuming — gamification
  (points/streaks/badges/confetti/leaderboards) was removed 2026-06-16,
  ten days before this doc existed, so that specific claim didn't hold
  up. But the broader one did: every section here is a brake (does this
  earn its place) and none is an accelerator (does this screen deserve
  warmth), and that asymmetry compounds even when no single rule is
  wrong. Section 20 is the stated counterweight, scoped narrowly (the
  Dashboard/kiosk surface only, not ARL/Admin, which correctly stay
  restrained per their own Linear/Stripe anchors), explicitly not a
  gamification revival, grounded in one real unfixed gap (the Tasks
  widget's completion ring treats 100% identically to 40%). First draft
  was checked against the rest of the doc's own conventions and found
  missing four things every comparable section already has: a
  governance gate (the quote-widget exception was user-agreed before
  building, Section 20 initially had no equivalent — fixed), a scope
  cap (one instance, evaluated, before proposing a second — fixed), a
  named failure mode for the Do Not Use-style list ("delight inflation"
  — a flourish shipped for one rare event quietly starting to fire on
  routine ones — fixed), and wiring into Testing Protocol/Behavior
  Rules the way Section 6 got wired in when it landed (fixed). No
  change to Section 2's neutral-primary-color decision — raised as
  possibly the single biggest contributor to "sterile," but treated as
  a deliberate boundary rather than folded into this pass: color is a
  system-wide token, and a Dashboard-only exception risks becoming two
  design systems, where a single bounded motion moment doesn't.
- 2026-07-01 — shipped Section 20's first (and, per its own scope cap,
  only-for-now) instance: `grid-tasks.tsx`'s completion ring now holds
  a distinct filled checkmark state ("ALL DONE") for 2.5s when
  `remainingCount` crosses from >0 to 0 while the widget is mounted,
  then settles back to the normal 100%/COMPLETE display — now in green
  instead of red, a correctness change (the ring should reflect true
  completion) separate from the flourish itself. Detection is derived
  during render, not inside a `useEffect`, per React's documented
  pattern for state depending on a prop change — the initial `useEffect`
  version tripped the new `react-hooks/set-state-in-effect` lint rule
  (synchronous `setState` in an effect body risks a cascading render);
  the effect now only owns the 2.5s timer, a genuine external-API side
  effect. Verified against Section 20's own Testing Protocol addition:
  doesn't fire on mount if the day was already complete when the widget
  loaded, doesn't replay for the same completion, and the ring stays
  fully clickable/navigable throughout — nothing gates behind it.
- 2026-07-01 — dashboard widget customization moved from per-location/
  per-ARL to tenant-wide, editable only via a new ARL Console page
  (Dashboard Layout). Prompted by a direct concern: free-form per-kiosk
  customization (drag/resize/add/remove widgets, persisted separately
  per location *and* per ARL account) meant an ARL overseeing several
  locations could see a different arrangement at every one, and the
  data model already allowed exactly that (`locations.gridLayout` and
  `arls.gridLayout` were two entirely separate saved layouts). Considered
  and explicitly rejected a middle option — multiple tenant-defined
  layouts, ARL-assignable per location, to accommodate tenants with
  multiple brands — because no concrete need for brand-differentiated
  dashboards exists yet (every current widget is universal restaurant-
  ops tooling), and because it wouldn't have actually shrunk anything:
  something still has to let a tenant *build* each of those layouts,
  meaning the full editor stays either way. One layout per tenant gets
  the stated goal (no more per-location drift) without building
  speculative multi-layout machinery for a need that hasn't shown up —
  matches the Admin Console plan's own precedent of naming and cutting
  speculative brand-level features rather than building them ahead of
  demand.

  **Schema**: `gridLayout` moved from `locations`/`arls` to `tenants`
  (migration `056_tenant_wide_dashboard_layout` in `db/index.ts`, plus
  a mirrored `drizzle/0007_tenant_wide_dashboard_layout.sql` — this
  codebase runs two separate migration systems, `scripts/migrate.js`
  applying `drizzle/*.sql` in production startup and `db/index.ts`'s
  own hand-rolled `migrate()` applying lazily on first DB access in the
  running app; found by tracing why the previous per-location column
  was added by a drizzle migration with no hand-rolled counterpart,
  discovered mid-verification when a local dev DB — which only ever
  runs the hand-rolled path, never `scripts/migrate.js` — turned out to
  be missing that column entirely, and separately missing `tenants.
  timezone` for the identical reason. That drift between the two
  systems predates this change and wasn't introduced by it; flagging it
  here since it's a real gap, not fixing it now since it's a separate,
  riskier cleanup. Deliberately did not mirror the `DROP COLUMN`
  statements into the drizzle file — confirmed live that `scripts/
  migrate.js`'s error-tolerance only forgives "duplicate column"/
  "already exists", not "no such column," so an untested DROP on a
  column that was never added via that path would throw; the hand-
  rolled migration's own catch-and-mark-applied-anyway wrapper already
  handles this safely (verified live against the real dev DB: `ADD
  COLUMN tenants.grid_layout` succeeded, both `DROP COLUMN` statements
  correctly no-opped with "no such column" caught and swallowed, all
  three the same operations `055_remove_gamification_points` already
  proved safe for this exact pattern).

  **API**: `/api/preferences/grid-layout` (per-location/per-ARL) deleted
  outright; new `/api/dashboard-layout` (GET — any authenticated tenant
  session, since kiosks need to read it; PUT — admin/superadmin ARL
  only, same gate `/api/tenants/settings` already uses) reads/writes
  `tenants.gridLayout` and broadcasts `dashboard-layout:updated` to
  every location and ARL in the tenant on save, via a new
  `broadcastDashboardLayoutUpdate` (replacing the old per-device-echo-
  aware `broadcastGridLayoutUpdate`, since there's no self-echo case
  left to guard against — the edit always comes from a different
  surface than the kiosks receiving it).

  **Kiosk** (`dashboard/page.tsx`): the settings cog, edit mode, and all
  drag/resize/add/remove UI removed entirely — the dashboard is now a
  pure read-only consumer of the tenant's layout. This also let the
  embed/mirror-view layout fetch drop its location-specific query
  params, since the layout is now identical regardless of which
  location's screen is being mirrored.

  **ARL Console**: new "Dashboard Layout" page (`/arl/dashboard-layout`,
  standalone nav item under Administration, `arl-sidebar.tsx`/
  `arl-views.ts`), reusing the *same* grid-editing components the kiosk
  used to host (`GridProvider`/`GridSurface`/`SettingsPanel`/
  `WidgetContainer`) rather than duplicating them — editing didn't get
  deleted, it got relocated to the one place it now belongs.
  `SettingsPanel` itself simplified from a browsing/editing toggle (cog
  → popover → "Customize widgets") to always-editing, since editing is
  now this page's entire purpose rather than a mode someone opts into
  from a kiosk. The editor previews widgets with empty/no-op stub data
  (`PREVIEW_DATA`) rather than real task/message content — widget
  bodies are already dimmed and non-interactive during editing
  (`widget-container.tsx`), so accuracy there was never the point, only
  size/position.

  **Known deliberate gap, not fixed in this pass**: the remote-view
  mirror system's embed-side "ARL edited the layout inside the mirror
  iframe, push it back to the target" path (`GridMirrorSync` in
  `grid-dashboard.tsx`) is now unreachable dead code — nothing edits
  `layout` from inside an embed anymore, since `SettingsPanel` no
  longer renders there. Left in place rather than torn out in the same
  pass, since it's interleaved with the *target → embed* view-sync
  effects in the same function (still needed, unrelated) in ways that
  deserve a careful, separate look rather than a rushed cut next to a
  schema migration. Flagged in-code at the top of `GridMirrorSync`.
- 2026-07-01 — Today's Tasks widget rebuilt from a flat scrolling list
  to a stacked card, one-task-at-a-time interface. User-proposed;
  checked against this doc *before* building, per Section 20's own
  precedent (agree the specifics first) even though this isn't an
  Earned Delight instance itself — it's a Section 0/11/16 layout
  redesign that happens to make routine completion less monotonous,
  a different category of change than a rare-event micro-interaction,
  so it doesn't count against Section 20's one-instance cap. Four
  concrete questions got resolved before any code was written:

  - **Task ordering**: `dueTime` is a soft, practical sequence (most
    tasks — food-safety checklists, shift routines — genuinely run in
    that order), not a hard dependency the data model enforces. The
    stack shows the soonest-due task first; tapping it opens a grid of
    every task today, each directly completable, as the escape hatch
    for the out-of-order case — this closed the gap between "the UI
    implies strict order" and "the data doesn't have one."
  - **Progress signal**: the old completion ring is gone, replaced by
    one horizontal bar across the top edge of the front card
    ("N/M tasks complete"). Section 18 only gets one signal for this
    fact now, not two competing ones.
  - **Expanded view vs. `/tasks`**: the tap-to-expand grid is scoped to
    *today only* — a quick, low-friction glance from the stack, not a
    second full-history browser. `/tasks` (multi-day, filterable)
    keeps that job entirely; the expanded grid has a button out to it,
    not a duplicate of it. Different scope, not a redundant surface.
  - **The widget's own frame**: removed. Added `hidesOwnFrame` to
    `grid-engine.ts` — a third category alongside `isAmbientWidget`
    (Clock: no header, no border, glanceable) and `isOutlineWidget`
    (Quote: border always, never filled) for a widget whose *content*
    already supplies a boundary (each stacked card is its own bordered,
    shadowed object), so a second outer frame around the whole widget
    restated one the cards already gave — the same "don't say it twice"
    reasoning Section 18 applies to data, applied here to chrome. Tasks
    keeps its icon+title header, unlike Clock — a card stack isn't as
    self-evidently "Today's Tasks" as a giant clock is self-evidently a
    clock. `widget-container.tsx` and `grid-mobile-stack.tsx` (which
    now gives Tasks the real card stack inline on mobile, not a
    tappable summary row, since it's the primary daily-use widget, not
    a glanceable aside) both switched from checking `isAmbientWidget`
    to `hidesOwnFrame` so the two presentations stay in agreement.

  The Earned Delight "ALL DONE" flourish (Changelog, earlier
  2026-07-01 entry) moved from the old ring onto a dedicated card in
  the new stack — same approved trigger and 2.5s effect, relocated
  rather than re-proposed, since the surface it lived on no longer
  exists.

  **Verification note**: static checks only (`tsc`/lint/304 tests/
  `next build` all clean) — a live browser walkthrough was attempted
  but blocked on this local dev DB having no seeded location account
  (and fixing that required clearing 2 partially-seeded ARL rows,
  which the permission system correctly stopped as an unrequested
  destructive action); the user chose to ship on static verification
  alone rather than resolve the seed data. Worth a manual check in a
  real browser before treating the visual result as confirmed.
- 2026-07-03 — that manual check happened, and it caught exactly the
  kind of bug static checks can't: the stacked-card fan was completely
  invisible on the real kiosk. The peek cards were offset 8px down but
  also 8px shorter, so their bottom edges landed flush with the
  full-height front card's — perfectly hidden behind it. A screenshot
  with six pending tasks showed one lone card and no stack at all.
  Fixed per the user's direction: the front card no longer fills the
  widget — it gives up 16px of height per peek card (`PEEK_DROP`), and
  each peek sits that much lower and 14px narrower per level
  (`PEEK_INSET`), so the fan visibly pokes out below the front card's
  bottom edge, matching the reference designs the redesign was based
  on. The lesson worth keeping: "renders without errors" says nothing
  about "the depth cue is actually visible" — layered/occluded UI
  needs eyes on real pixels, which is why the previous entry's
  verification caveat existed in the first place. Tuned once more
  after a second kiosk screenshot: 16px drop / 14px inset read as
  barely-there slivers at real kiosk scale and viewing distance —
  now 28px / 22px with higher peek opacity (0.7/0.45).

  Separately: a report that "Complete doesn't stick — it flashes
  complete then reverts" turned up no provable bug in the completion/
  refetch data flow itself (location-id resolution, socket timing, and
  date/timezone handling were all traced and found consistent), but
  did turn up a real, adjacent one — the failure path was completely
  silent. `handleComplete` (`dashboard/page.tsx`) already reconciled
  with the server on both success *and* failure by refetching, which
  is correct, but a failed completion and a successful one were
  visually identical: both ended in a refetch, so a rejected request
  looked exactly like an inexplicable revert, with no way to tell
  which had happened. `onComplete`'s contract changed from
  `(taskId) => void` to `(taskId) => Promise<boolean>`, threaded
  through `WidgetData`, so the widget can tell "moved on because it's
  done" apart from "the request failed" — on failure it now shows an
  inline "Couldn't mark that complete — try again," and the real HTTP
  status/body is logged to the console instead of vanishing. Whether
  this fixed the original revert or the original report was a
  transient/environmental issue that resolved on its own is genuinely
  unclear — the user confirmed completions now stick, but no failure
  message or console error was ever observed to confirm the mechanism.
  Documented as a known-good fix for a real bug (the silence) alongside
  an open question about a different, never-reproduced one (the revert).
- 2026-07-04 — two more passes on the stack's visual design, both
  against a reference screenshot of a different app's card-stack/
  progress-bar pattern:
  - **Progress bar now floats above the front card** instead of living
    flush against its top edge inside it — a real gap (`BAR_GAP`,
    10px), not touching. The stack reserves `BAR_HEIGHT + BAR_GAP` of
    height above the front card for it; the in-card bar strip is gone
    entirely, replaced by a `position: absolute` pill-shaped track at
    the top of the stack container.
  - **Peek cards now lean instead of just dropping straight down.**
    Uniform vertical offset plus width-narrowing (the 2026-07-03 fix)
    made a visible fan, but a fan of perfectly concentric rectangles
    still reads as "a card sitting on a shadow shelf," not "a stack of
    cards" — the reference's back card visibly leans, its corners
    poking out past the front card's edges rather than staying
    centered under it. Each peek now rotates `PEEK_LEAN` (3°) further
    off-axis per level, alternating side, on top of the existing
    drop — `PEEK_INSET` shrunk from 22px to 8px accordingly, since most
    of the reveal now comes from the lean rather than the peek being
    narrower. Peek fill changed from an opacity-faded copy of the
    card's own background to a solid `bg-muted`, which reads as a
    distinct layer instead of a translucent ghost of the front card.

  Both of those shipped full-bleed (front card and peeks spanning the
  widget's full width) and broke on the next kiosk screenshot: a
  leaning card has nowhere to swing into when its edges already touch
  the widget's own overflow-hidden boundary, so the peeks' rotated
  corners were hard-clipped — visible as jagged cut edges rather than
  a clean lean. The floating bar had the same full-bleed problem for a
  different reason: spanning edge-to-edge made it read as a strip that
  belonged to the whole widget, not to the card sitting below it —
  "floating" was taken more literally than intended. Fixed by giving
  the front card real margin on every side instead of filling the
  widget: `CARD_INSET_X_PCT` (15% each side) horizontally, plus
  `CARD_INSET_TOP`/`CARD_INSET_BOTTOM` (10px/14px) reserved above and
  below the fan. That margin does double duty — it's the breathing
  room the card was missing, and it's the room the leaning peeks
  (whose own inset now starts from the card's margin, stepping in
  `PEEK_INSET_STEP` further per level) actually swing into without
  clipping. The progress bar now shares the card's own horizontal
  margin instead of spanning the full widget, so it reads as sitting
  above *that card* rather than as an unrelated strip across the top
  of the widget.

  That fix didn't hold either — reported as still clipping, plus "the
  progress bar didn't change" and "make the cards smaller, A LOT
  smaller." Debugged properly this time instead of tuning by eye:
  logged into a local dev copy as a real location session, resized the
  Tasks widget to a tall/narrow footprint (the shape actually reported
  — the default demo layout is wide/short and never would have shown
  this), and captured real screenshots via Playwright rather than
  reasoning about CSS in the abstract. That reproduced it immediately
  and revealed two actual root causes, neither of which was "not
  enough margin":
  1. **The front card had no size cap** — it filled 100% of whatever
     height the widget happened to have. On a tall/narrow widget that
     makes the card very tall, and a leaning peek's corner
     displacement scales with the card's own height (rotating a
     500px-tall card by even a few degrees swings its corners tens of
     pixels sideways) — no amount of fixed-percentage margin fixes
     that, because the displacement grows with the card, not with the
     margin. The percentage-inset fix from earlier the same day
     patched the symptom on one specific screenshot's proportions
     without fixing the actual scaling problem.
  2. **The bar was floating in a void with no visible edges.** Tasks
     hides its own outer frame (`hidesOwnFrame` — no border or fill
     around the widget itself, see the redesign's original entry
     above), so "float the bar above the card, with a gap" landed in
     empty page background with nothing to be visibly padded *from*.
     Geometrically the bar did move; perceptually there was nothing
     there to read it against, so it looked unchanged.
  Fixed by removing the trigonometry instead of feeding it more
  margin: `CARD_MAX_WIDTH`/`CARD_MAX_HEIGHT` (320/380px) cap the front
  card regardless of the widget's actual grid size, so its height —
  and therefore any rotation-driven displacement — is bounded no
  matter how the widget is resized. Peek cards dropped rotation
  entirely: each is now just `PEEK_REVEAL` (8px) wider/taller than the
  card in front of it, poking out evenly along the sides and bottom,
  which reads as a stack without any displacement that scales with
  card size. The stack centers this capped card in whatever space the
  widget provides via flexbox, with `STACK_PADDING` (16px) as real
  breathing room. The progress bar moved back inside the card, with
  actual padding around it (`p-4 pb-0`) instead of being flush against
  the top edge — the fix the original complaint asked for, just
  applied to the one boundary that's actually visible on this widget.

  This was verified for real this time, not just eyeballed: connected
  Railway CLI access, confirmed the exact commit deployed live, then
  logged into the actual production tenant via Playwright (with the
  user's explicit go-ahead, since the tenant isn't in live use yet)
  and screenshotted the real widget with its real data — same result
  as the local repro. First time this session a fix was confirmed on
  the live deployment rather than a local stand-in.

  With the card's height now bounded, the peek lean came back:
  `PEEK_LEAN` (3°, alternating side) was the thing that clipped
  originally specifically because the card's height was unbounded —
  a lean's corner displacement scales with the card's own height, and
  there was no card-size limit to bound that scaling against. Now
  that `CARD_MAX_HEIGHT` puts a hard ceiling on it, the worst case is
  calculable (half-height 190px × sin(6°) for the second peek ≈ 20px)
  instead of open-ended, so `STACK_PADDING` was raised 16px → 24px to
  clear it with room to spare, and the lean was reintroduced knowing
  it can no longer blow past the container. Reverified locally against
  both a tall/narrow widget (the shape that broke before) and the
  default wide/short one — no clipping either way.
- 2026-07-14 — the stacked-card interface itself got replaced, not
  tuned again. After the lean was safely working, the user's own
  read on it: "the change in way that we display Today's Tasks
  doesn't feel right." That's a different kind of feedback than any
  single bug report this widget had gotten — every prior fix this
  widget needed (invisible fan, too subtle, clipping, disconnected
  bar, oversized card) was geometry triage on the same underlying
  shape. Five rounds of that on one widget is itself a signal: a
  leaning card-fan wants a fixed, generous canvas to read as a stack
  (the onboarding-wizard mockup it was modeled on has exactly that),
  and this widget doesn't have one — it lives in an arbitrarily
  resizable dashboard grid cell. Every fix made the geometry survive a
  given widget shape; none of them addressed that the metaphor itself
  fights the container.
  Replaced with a **Now/Next** two-tier display instead of proposing a
  sixth geometry fix: the current (soonest-due) task shown prominently
  with its progress bar and Complete button, unchanged from before,
  and a single quieter row underneath showing just the next task after
  it — no stack, no peeks, no rotation, no size caps. "How many remain"
  stays visible via the existing `N/total tasks complete` count; "what's
  coming" is now one plain row instead of implied by a fan of card
  edges. Chosen over other options discussed (a redesigned flat
  checklist, a plain remaining-count badge) because it's the smallest
  change that keeps the part of the original redesign that was
  probably the actual point — one task, one decision, at a time — while
  dropping the part that kept breaking.
  `CARD_MAX_WIDTH` (320px) is the only geometry constant left, kept
  only so text doesn't stretch absurdly wide on a very wide widget —
  the card and Next row now size to their own content and center in
  whatever space the widget provides, instead of being stretched or
  capped to fill it.
  Verified locally on both a tall/narrow and default wide/short widget,
  plus an actual complete-and-advance click through Playwright
  (confirmed the front card swaps and the Next row updates correctly,
  not just that it renders).
- 2026-07-14 — Now/Next's content-sized-and-centered layout (the entry
  above) turned out to have the same problem in reverse: on a widget
  resized tall — a real, already-in-use layout, not a hypothetical —
  the card stayed small and most of the height went unused. Two
  options were on the table: shrink the widget to match the content,
  or make the content scale up to use the space. Went with scaling.
  `containerType: "size"` on the centering wrapper turns CSS
  `cqw`/`cqh` units into "percent of this widget" instead of "percent
  of the viewport," so icon size, title/meta/button text, button
  height, progress-bar thickness, and inter-element gaps all grow with
  the widget itself — clamped between the original fixed-size values
  (the floor) and a hero-sized ceiling (so it doesn't blow up on an
  enormous widget), via `SCALE_VARS`.
  First pass sized text purely off container *height* (`cqh`) and
  broke immediately on the tall-*and-narrow* case: text grew fast
  enough that the task title truncated to "Morning ..." and the header
  row wrapped awkwardly, because nothing was checking whether the
  width could actually fit what the height said to render. Fixed by
  sizing text as `clamp(min, min(Xcqh, Ycqw), max)` — bounded by
  whichever dimension is more restrictive — so a narrow widget can't
  grow text past what its own width allows, regardless of how much
  height is available. Bar thickness and gaps stayed height-only
  (a bar just spans the width at whatever thickness; a gap has no
  content to overflow, so there's nothing for width to protect
  against).
  Separately, the task title's `truncate` (single-line ellipsis)
  became `line-clamp-2`: at hero scale, on a tall widget, insisting on
  one line was the thing forcing truncation in the first place — the
  same vertical space this change exists to use is exactly what a
  second line needs, so wrapping costs nothing and loses no
  information, versus an ellipsis that quietly drops the end of a
  task's actual name.
  Reverified on both widget shapes after the width-bounding fix: the
  tall/narrow case now shows the full title across two lines at a
  visibly larger scale with no wrapping/truncation defects in the
  header row, and the default wide/short case scales modestly (already
  near its floor) with no regression from before.
