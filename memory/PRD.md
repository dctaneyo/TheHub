# The Hub - PRD & Progress

## Original Problem Statement
Change the lucide icons to Phosphor duotone icons. Make sure you don't use replace all. You need to manually change each and every one of them. An earlier attempt to change the icons resulted in a lot of corrupt files due to another AI agent using replace all. Be methodical and safe.

## Architecture
- **Framework**: Next.js 16.1.6 with React 19
- **Icon Library**: Migrated from `lucide-react` → `@phosphor-icons/react` v2.1.10
- **Migration Pattern**: Centralized wrapper file at `src/lib/icons.tsx` that re-exports Phosphor duotone icons under original Lucide names

## What's Been Implemented (Jan 2026)
- Created `src/lib/icons.tsx` — compatibility wrapper mapping 132 Lucide icon names → Phosphor equivalents with `weight="duotone"` default
- Updated 60+ source files to import from `@/lib/icons` instead of `lucide-react`
- Updated `components.json` icon library reference
- All TypeScript compilation passes cleanly

## Key Icon Mappings
| Lucide | Phosphor |
|--------|----------|
| Activity | Pulse |
| AlertCircle | WarningCircle |
| AlertTriangle | Warning |
| ChevronDown/Left/Right/Up | CaretDown/Left/Right/Up |
| Loader2 | SpinnerGap |
| MessageCircle | ChatCircle |
| Search | MagnifyingGlass |
| Send | PaperPlaneTilt |
| Settings | GearSix |
| Store | Storefront |
| Trash2 | Trash |
| Users | UsersThree |
| Video | VideoCamera |
| Zap | Lightning |
| (and 118 more) | |

## Backlog
- P2: Remove `lucide-react` from package.json dependencies (no longer imported but still listed)
- P2: Pre-existing middleware deprecation warning (src/middleware.ts)
