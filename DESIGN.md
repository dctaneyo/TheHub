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
all; reserve the pill treatment for things that are actually tappable
(Settings, Connection Status). Wrapping passive content in the same
shape as real buttons is a false affordance — it tells the eye
"interactive" about something that isn't.

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

**Check:** grep for `lucide-react` or `@phosphor-icons/react` outside
`src/lib/icons.tsx` — any hit is a violation. Grep for a given action's icon
(e.g. `X` for remove/close) and confirm every screen using that action uses
the same one.

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

---

## 16. User Flow

A flow is correct when two things are always true: the user knows what just
happened, and the user knows how to get back. Most "this feels unfinished"
reports trace to one of those breaking somewhere, not to a single screen
looking wrong. This section is grounded in an actual audit of this app's
flows (login, signup, dashboard edit mode, task completion, remote view,
connection loss, forms/messages) — not general UX advice — and gets
extended the same way: trace a real flow, cite the file/line, fix or state
the exception.

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
UI state on success).

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
