# Incremental Refactor Plan

_Companion to DESIGN.md, CODE-STYLE-AUDIT.md, and ARL-AUDIT-PLAN.md._  
_Written 2026-06-28. Answers three questions in order: Can we do this without starting over? What does Radix + custom Tailwind mean in practice? What's the sequence?_

---

## 1. Can we do this without starting over?

**Yes.** Nothing in the gap between "current state" and "target state" requires a rewrite. Every finding in the audit series maps to a bounded, file-scoped change. The architecture is correct: Next.js, Framer Motion, Socket.io, Manrope + Space Mono, the semantic color system — all of it stays. What changes is:

- Three infrastructure files that don't exist yet (built once, unblock everything else)
- A single design token decision (the primary action color — see `design-options.html`)
- File-by-file component fixes following `ARL-AUDIT-PLAN.md`'s existing worklist
- A migration strategy for the component library (gradual, not a flag-day rewrite)

**What "starting over" would actually mean:** rebuilding the real-time socket foundation, the kiosk grid engine, the meeting room flow, the forms system, the auth layer — none of which have design-level problems. The code audit rated the socket layer as the _cleanest_ thing in the codebase. Starting over to fix UI inconsistencies is throwing away what works to fix what doesn't.

---

## 2. Radix UI + Custom Tailwind — What This Means In Practice

### What shadcn/ui actually is

shadcn/ui is not a component library in the traditional sense. It's Radix UI primitives + an opinionated Tailwind stylesheet, delivered as copy-paste source files. You already own every component file. There's no `shadcn` package version to bump.

This matters because the migration path is **additive, not destructive**:

```
Current:  Radix (via shadcn) + shadcn's default styles
Target:   Radix (via shadcn) + our own styles replacing shadcn's defaults
```

The accessibility layer (focus management, keyboard navigation, ARIA attributes, portal rendering) is Radix, and Radix is already in the project. What we're changing is the visual layer on top of it.

### Three categories of change

**Category 1: Token overrides (already partly done)**  
`src/app/globals.css` already overrides the shadcn CSS variables (`--primary`, `--card`, `--background`, etc.) with project-specific values. This is the correct layer to work in. The design option decision (see `design-options.html`) produces a diff to this file.

**Category 2: Existing component files in `src/components/ui/`**  
These are the copy-paste shadcn source files (Button, Input, Dialog, Select, etc.). They can be edited directly — they're ours. The goal is replacing shadcn's Tailwind class lists with classes that express the project's own design decisions, not shadcn's.

_Priority order (by impact / audit severity):_
1. `dialog.tsx` — used infrequently, hand-rolled modals dominate; migrate Dialog first so any new modal uses a consistent base
2. `button.tsx` — the primary action color decision lives here
3. `badge.tsx` — currently bypassed almost entirely (Critical drift finding); either use it or delete it
4. `card.tsx` — same situation as Badge; currently bypassed in favor of raw `div` + Tailwind
5. `avatar.tsx`, `skeleton.tsx` — low-impact but part of the same drift

**Category 3: New components built going forward**  
Any new component that needs Radix primitives (dropdown menus, tooltips, popovers, date pickers) gets built directly on Radix — no shadcn wrapper, just the Radix import and custom Tailwind classes. This isn't a policy flip; it's what you'd naturally do once the shadcn defaults aren't appealing as a starting point.

---

## 3. Phase Sequence

### Phase 0: Design system decision (do this first, unblocks everything)

Open `design-options.html`. Choose a design direction. Record the decision in DESIGN.md Section 0 (the four decisions). This is the only phase that requires agreement before code gets written — everything downstream flows from it.

Decisions required:
- [ ] **Primary action color**: neutral (dark-on-light / white-on-dark) vs. brand red (#e4002b)
- [ ] **Rounding**: keep 16px / reduce to 12px / reduce to 8px
- [ ] **Purple elimination**: confirmed — replace with teal in role badges, remove from `--hub-purple` semantic assignments
- [ ] **Stat card hierarchy signal**: uniform weight vs. severity-scaled left border vs. size differential

Once chosen, update `globals.css` with the decided token values. This is the lowest-cost, highest-leverage change in the entire plan — a one-file diff that visually lands the design direction across every screen simultaneously.

---

### Phase 1: Three infrastructure files (zero visual change)

These exist in the plan because every other phase is slower without them. Build them first, before touching any component.

**`src/lib/motion.ts`** — animation constants  
_Eliminates the 17-value duration drift (Code Audit §1c). Referenced by `MOTION.fast`, `MOTION.normal`, etc. in component files going forward._

```ts
export const MOTION = {
  fast:   { duration: 0.15, ease: "easeOut" },
  normal: { duration: 0.2,  ease: "easeOut" },
  slow:   { duration: 0.5,  ease: "easeInOut" },
  loop: {
    shimmer: { duration: 1.2, repeat: Infinity, ease: "easeInOut" },
    pulse:   { duration: 1.5, repeat: Infinity, ease: "easeInOut" },
  },
} as const;
```

**`src/hooks/use-api.ts`** — single data fetching hook  
_Eliminates the inconsistent AbortController / cleanup / error handling drift (Code Audit §3). Every component that fetches data uses this._

```ts
// Minimal contract:
function useApi<T>(url: string, deps: unknown[] = []) {
  // Returns: { data, loading, error, refetch }
  // Manages: AbortController, cleanup on unmount/dep change
  // Error shape: consistent { message: string, status?: number }
}
```

**`src/components/ui/skeleton.tsx` — consolidation**  
_Already exists. Remove all hand-rolled `animate-pulse div` patterns from the 6+ files that bypass it (Code Audit §1d). Every loading state uses `<Skeleton>` or one of its named variants._

---

### Phase 2: ARL console component fixes

This is `ARL-AUDIT-PLAN.md`'s file-by-file worklist, executed in priority order. No new approach needed — the plan already exists; this phase is execution. Brief summary:

| File | Primary fix | DESIGN.md sections closed |
|---|---|---|
| `data-management.tsx` | 21 flat cards → 2 severity tiers; 11-color map → 3-color severity scale | §5, §7, §8, §11, §12 |
| `tenant-settings.tsx` | 4 flat sections → 3 tabs by edit cadence | §5, §12 |
| `overview-dashboard.tsx` | Merge Ticker+Activity; delete duplicate trend chart | §18, §12 |
| `task-form-modal.tsx` | Single 2-col grid; selected state beyond color-only | §4, §7 |
| `user-management.tsx` | Overflow button for rare actions; permissions modal grid alignment | §4, §5, §12 |
| `arl-sidebar.tsx` | Operations/Administration clusters; dark badge pair | §8, §12 |
| `arl/layout.tsx` | Toast gate on overview; dark badge pair | §18, §8 |

**Apply motion constants while in each file.** The 20+ missing `initial` props (Code Audit §1b) get fixed as you touch each component — batch the fix with whatever structural change is already happening, not a separate pass.

---

### Phase 3: `any` cleanup and TypeScript precision

Low urgency (Code Audit rated TypeScript as "Low" severity), but do it during Phase 2 whenever you're in a file:

- Replace `any` with the actual narrowest type. If you don't know the shape, add a `// TODO: type this` comment rather than leaving `any` silently.
- Target files identified: `src/app/api/arl/[id]/route.ts`, `src/components/arl/analytics-dashboard.tsx`, `src/components/dashboard/restaurant-chat.tsx` (most instances).

---

### Phase 4: New component policy

Any new component family — a date picker, a combobox, a popover tooltip system — gets built as:

```tsx
// 1. Import from Radix directly
import * as Popover from "@radix-ui/react-popover";

// 2. Style with project Tailwind classes (not shadcn defaults)
// 3. Export from src/components/ui/<name>.tsx (same file location as existing shadcn components)
// 4. Add to this plan's "done" checklist
```

The existing shadcn component files (`button.tsx`, `dialog.tsx`, etc.) get migrated to this pattern as they're touched for other reasons. There's no "migrate all shadcn components on a fixed date" — they migrate when they're opened anyway.

---

## 4. What Stays Exactly As Is

These are the parts of the codebase the audit explicitly found clean or deliberately correct. Do not change them as part of this plan:

- **Socket event handling** — rated "Clean, None" in Code Audit §4. The `useSocket` contract, event naming, and cleanup are consistent everywhere.
- **API route conventions** — rated "Mostly clean, Low" in Code Audit §6. Two legacy error shapes need fixing; everything else is correct.
- **File organization and naming** — rated "Clean, None" in Code Audit §7. Directory structure, naming conventions, and barrel files are 100% consistent.
- **`src/lib/icons.tsx` barrel** — the single-import-point rule is already enforced in practice. Keep enforcing it.
- **Manrope + Space Mono** — the type pairing is correct and deliberate. The four-size scale is already implemented.
- **The semantic color system** (red=urgency, amber=priority, emerald=status, teal=remote) — this is the design's primary data-encoding mechanism. The problem isn't the system; it's the additional non-semantic color usage (purple, scattered blue) that will go away via Phase 0's token decision.
- **The kiosk inactivity timer** — correct pattern, correctly scoped to `SubPageHeader`. Leave alone.
- **The login morph animation** — deliberate design moment, correctly implemented.

---

## 5. Constraints and Risks

**Risk 1: Design decision paralysis (Phase 0)**  
The whole plan moves at the speed of the Phase 0 decision. If the design option isn't chosen, Phase 1 can start (it has no visual dependency), but Phase 2 can't land consistently. Mitigate by treating `design-options.html` as the forcing function — a concrete artifact to react to, not an abstract discussion.

**Risk 2: Partial migration leaving mixed UI**  
The worst outcome is running Phases 0-2 halfway and shipping a UI where some components use the new design tokens and some use the old ones. Mitigate by completing each file's fix before moving to the next — no partial-file commits. The ARL-AUDIT-PLAN.md's organization by file (not by principle) already enforces this.

**Risk 3: Motion `initial` prop fixes breaking existing animations**  
Adding `initial` props to 20+ Framer Motion elements is mechanical but could cause unexpected visual regression if the surrounding `AnimatePresence` already has `initial={false}`. Check each fix: if the parent has `initial={false}`, the element-level `initial` is the right fix; if it doesn't, confirm the entrance animation is actually desired in context before adding it. Add the fix file-by-file; don't batch it as a global find-and-replace.

---

## 6. Definition of Done

The refactor is complete when:

- [ ] `src/lib/motion.ts` exists and all Framer Motion `transition` props in new/touched files reference it
- [ ] `src/hooks/use-api.ts` exists and all data-fetching components touched in Phase 2 use it
- [ ] All 6 hand-rolled skeleton implementations replaced with `<Skeleton>` variants
- [ ] All 20+ missing `initial` props added (Code Audit §1b list)
- [ ] `data-management.tsx`, `tenant-settings.tsx`, `overview-dashboard.tsx`, `task-form-modal.tsx`, `user-management.tsx`, `arl-sidebar.tsx`, `arl/layout.tsx` match ARL-AUDIT-PLAN.md's worklist
- [ ] Primary action button color reflects Phase 0's decision in `button.tsx`
- [ ] `globals.css` token values match the chosen design option
- [ ] Purple (`--hub-purple`, `bg-purple-*/text-purple-*`) removed from all semantic/role uses; replaced per Phase 0 decision
- [ ] No `any` added in any Phase 2+ file (existing `any` instances tracked separately)
- [ ] DESIGN.md Section 0's four decisions documented for both surfaces (ARL console, kiosk dashboard)
