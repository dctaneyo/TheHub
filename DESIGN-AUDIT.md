# Design Audit — 2026-06-26

Audit of the current codebase against [DESIGN.md](DESIGN.md), using
`npm run design:scan` plus manual review. No code changes were made as
part of this audit — findings only, for input into the planned full
redesign.

## Scanner summary

```
files scanned: 301
findings: 736
vibe score: 1193
verdict: "STRONG AI-default look"
```

That verdict is overstated for this codebase — see the per-rule
breakdown below. Most of the volume is the scanner's regex patterns
firing on legitimate, already-deliberate conventions (a consistent
global radius token, a categorical color system for tagging types),
not on actual unconsidered AI defaults.

## Per-rule breakdown

| Rule | Hits | Assessment |
|---|---|---|
| `claude-default-look` | 37 | **All false positives.** Fires on `bg-amber/orange-50/100`, which only signals the "tasteful AI default" when paired with a cream background + serif display font. This app uses Inter exclusively with no serif anywhere. Every hit is a legitimate semantic priority/status color (e.g. `priority === "high"` → orange). No real signal from this rule in this codebase. |
| `ai-purple` | 78 | **Mostly false positive.** Most hits are purple/indigo used as one entry in an existing categorical color system (task type, user type, conversation type) alongside blue/emerald/amber/red — a real semantic decision already made, purple is just one of the categories. A genuine handful are real unconsidered defaults — see Genuine Findings below. |
| `rounded-everything` | 219 | **Mostly not a tell here.** `--radius: 1rem` is a single global theme token applied consistently (the shadcn convention), which is the *opposite* of the AI tell (random, uncoordinated per-component radius). Some genuine overuse of pill/`rounded-full` likely exists but needs eyeballing per component — regex can't distinguish a deliberate pill button from overuse. |
| `fade-in-animations` | 128 | **Real, but the fix isn't "remove animation."** The actual violation is inconsistent transition durations, not the presence of motion. Spot-checked `login/page.tsx` and found 6+ different durations (0.15s, 0.2s, 0.3s, 0.4s, 0.5s, 2s) with no shared standard — a direct violation of DESIGN.md Section 9 (one standard duration/easing should govern ordinary feedback). |
| `emoji-as-icons` | 73 | **Largely a different category than the rule intends.** 38 of 73 hits are in `src/lib/funny-messages.ts`, almost certainly user-facing copy/personality content (toasts, empty states) rather than emoji substituting for a real icon set. Worth a quick look but likely not a violation of the rule's actual intent. |
| `purple-blue-gradient` | 2 | **Real, both genuine hits.** |
| `hero-three-cards` | 1 | **False positive** — a 3-column meeting list grid (`scheduled-meetings.tsx:303`), not a marketing hero-then-cards skeleton. |

## Genuine findings (no new palette/token decision required to fix)

These are unambiguous — removing them doesn't require deciding anything
new about the eventual redesign, they're just unconsidered defaults:

1. **`src/components/dashboard/celebrations.tsx:253`** —
   `bg-gradient-to-br from-purple-600 to-blue-600` — textbook
   purple-to-blue gradient tell.
2. **`src/components/dashboard/celebrations.tsx:224`** — purple radial
   gradient blob, same family of issue.
3. **`src/components/dashboard/motivational-quote.tsx`** — purple
   sparkle icon + purple-to-blue gradient card background (light and
   dark variants). Component-for-component, this reads as the cliché
   "AI-generated inspirational quote widget." Worth a full rework, not
   just a color swap.
4. **`src/components/confirm-dialog.tsx:29-30`** — an `indigo` dialog
   variant with no stated semantic meaning (just "the variant that
   isn't red/green/amber") — an arbitrary default, not a decision.
5. **Loading spinners** in `src/app/dashboard/page.tsx:289` and
   `src/components/arl/remote-viewer.tsx:455-456` use `indigo-500` with
   no relation to anything else on screen — arbitrary.
6. **Motion duration inconsistency** — `src/app/login/page.tsx` alone
   has 6+ different transition durations with no shared standard
   (DESIGN.md Section 9).

## Deferred to the full redesign (require new token/palette decisions)

- The ~200 `rounded-everything` hits and ~70 remaining `ai-purple`
  categorical-color hits would require inventing a replacement
  radius/color system on the spot to "fix" properly. Doing that now,
  outside the planned redesign, risks the exact mistake DESIGN.md warns
  against: swapping one unconsidered default for another
  equally-unconsidered one. These should be addressed as part of the
  redesign's actual token decisions (Section 0 of DESIGN.md), not
  patched piecemeal ahead of it.
- The categorical color system itself (which hex maps to which task
  type / user type / conversation type) is a real existing decision,
  but it was never written down anywhere. Worth documenting explicitly
  once the redesign's palette is set, so future additions don't
  reintroduce arbitrary choices.

## Non-findings worth noting

- No hero+three-card marketing skeleton anywhere in the app — expected,
  since this is a dashboard/tool product, not a marketing site.
- No serif/cream "tasteful default" aesthetic anywhere — the codebase
  is consistently Inter + the existing card/background tokens.
- Dark mode already implements correct elevation depth (cards lighter
  than background, not a naive inverted-light-mode look) — this was
  confirmed by direct inspection of `globals.css`, predating this
  audit.
