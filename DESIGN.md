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

One typeface, chosen deliberately, used everywhere. A small, fixed set
of sizes and weights, each with a defined job — not a size or weight
picked per-component on the fly. Tighter scales for dense/functional
UI, more expressive range only where content (e.g. marketing headlines)
actually calls for it. Body text wraps at roughly 75 characters per
line.

**Check:** any inline font-size or font-weight that isn't traceable to
a named scale entry is a violation, not a judgment call.

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

Spacing follows one base unit and its multiples — no arbitrary one-off
values.

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

## 14. Do Not Use

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
- **Redundant icon+label pairs** where the icon adds no information.
- **Hover-only feedback** — any interactive treatment defined only on
  `:hover` with no active/press equivalent. This product runs on
  touchscreen kiosks with no pointer; hover-only feedback is invisible
  in practice and risks the "stuck hover" bug on touch browsers.

### Non-Tells — do not flag these as slop

Don't over-correct into banning ordinary modern design: mesh/blob
gradient backgrounds used deliberately, bento-grid layouts, dark mode
itself, and shadcn/Tailwind as tools.

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
- 2026-06-26 — added Sections 12-14 (data drives the UI, progressive
  disclosure & spectrum of explicitness, UI is what you can't see),
  sourced from a second design-principles video. Identified a concrete
  instance of Section 14's problem already in this codebase: 13
  icon-only controls relying solely on the hover-triggered native
  `title` attribute for explanation, which doesn't function on a
  touchscreen kiosk.
