# Hostinger Deployment Audit

## Executive Summary

The previous agent made **13 commits** across **133 files** to fix a single problem: `better-sqlite3` native compilation fails on Hostinger. Instead of a surgical 2-3 file fix, it progressively destroyed the application — downgrading frameworks, replacing components with emoji placeholders, gutting configuration, and creating cascading import errors it then chased across 90+ files.

**The fix should have touched ~3 files. It touched 133.**

---

## The Actual Problem

`better-sqlite3` is a native Node.js addon requiring C++ compilation (`node-gyp`, Python, make, gcc). Hostinger's build environment lacks these tools, so `npm install` fails.

**Secondary issue**: Next.js 16 requires Node.js >= 20.9.0, but Hostinger runs Node.js 18.x. A Next.js downgrade to 15.x was legitimately needed — but the agent botched it.

---

## Catalog of Mistakes

### Category 1: Unnecessary Downgrades

| What | Main Branch | What Agent Did | Impact |
|------|------------|----------------|--------|
| React | 19.2.3 | Downgraded to 18.3.1 | Broke radix-ui, Next.js compat |
| Next.js | 16.1.6 | Downgraded to 15.1.6 (deprecated, CVE) | Correct idea, wrong version |
| Tailwind | v4 (`@tailwindcss/postcss`) | Replaced with v3 (`tailwind.config.js`) | Completely different config system |
| radix-ui | v1.4.3 (unified package) | Split into ~20 individual `@radix-ui/react-*` packages | Wrong versions, import breakage |
| uuid | ^13.0.0 | Downgraded to ^10.0.0 | Unnecessary |

**React 19 → 18 was completely unnecessary.** Next.js 15 supports React 19. The agent created a version mismatch nightmare.

### Category 2: Destroyed Configuration

- **`next.config.ts`**: Gutted from 213 lines to 28. Removed:
  - Sentry error tracking integration
  - Content Security Policy headers
  - PWA runtime caching rules (fonts, images, API, etc.)
  - Build ID generation
  - React Compiler config
  - Allowed dev origins
- **`postcss.config.mjs`**: Replaced Tailwind v4 config with a v3 `postcss.config.js`
- **Created `tailwind.config.js`**: Main uses Tailwind v4 which doesn't use this file

### Category 3: Destroyed Source Code

- **`src/lib/icons.tsx`**: Replaced 281 lines of Phosphor icon wrappers (Building2, Plus, Pencil, etc. with `className` support) with 16 lines of emoji `<span>` elements that don't accept props
- **`src/components/ui/button.tsx`**: Overwrote existing shadcn/ui component
- **`src/components/ui/input.tsx`**: Overwrote existing shadcn/ui component
- **`src/app/admin/page.tsx`**: Changed imports to use inline `./components` file
- **Created `src/app/admin/components.tsx`**: Duplicate emoji-based components

### Category 4: Database Migration Chaos

- **Moved `src/lib/db/` → `src/lib/db-old/`**: Broke schema imports
- **Created `src/lib/db-simple/`**: Incomplete libsql wrapper with broken "compat" layer
- **Changed ALL 90+ API route imports**: `@/lib/db` → `@/lib/db-simple`
- **Sed command error**: Created `@/lib/db-simple-simple` in all files, then had to fix
- **Changed UI component utils imports**: `@/lib/utils` → `./utils` in all UI components
- **Created duplicate `src/components/ui/utils.ts`**

### Category 5: Removed Critical Packages

Removed from dependencies:
- `@apollo/client` — GraphQL client
- `@graphql-tools/schema` — GraphQL schema tools
- `graphql` — GraphQL core
- `graphql-yoga` — GraphQL server
- `workbox-webpack-plugin` — Service worker tooling

Removed ALL devDependencies:
- `typescript` — TypeScript compiler
- `@types/*` — All type definitions
- `eslint` / `eslint-config-next` — Linting
- `vitest` / `@testing-library/*` — Testing
- `drizzle-kit` — Database migration tool
- `shadcn` — Component generator
- `@tailwindcss/postcss` — Tailwind v4 PostCSS plugin
- `tw-animate-css` — Animation utilities

### Category 6: Junk Files Created

- `package.hostinger.json` — Unused alternate package.json
- `package.tmp.json` — Leftover temp file
- `next.config.backup.ts` — Backup of destroyed config
- `next.config.hostinger.ts` — Unused alternate config
- `deploy-hostinger.sh` — Unused deployment script
- `hostinger.json` — Unused config
- `.htaccess` — Apache config (Hostinger uses Node, not Apache for this)
- `app.js` — Unused Passenger entry point
- `.env.hostinger` — Template env file
- `README-HOSTINGER.md` — Instructions for broken setup
- `src/lib/db-hostinger.ts`, `db-turso.ts`, `db-universal.ts`, `db-simple.ts` — Abandoned DB attempts
- `src/lib/index.ts`, `src/components/ui/index.ts` — Unnecessary barrel files

---

## The Correct Fix (What Should Have Been Done)

### Step 1: Downgrade Next.js (for Node 18 compat)
Change `next` from `16.1.6` to latest `15.x`. Keep React 19, keep everything else.

### Step 2: Remove better-sqlite3
Remove `better-sqlite3` from dependencies, `@types/better-sqlite3` from devDependencies. The project already has `@libsql/client` in dependencies.

### Step 3: Rewrite ONE file — `src/lib/db/index.ts`
Replace `better-sqlite3` + `drizzle-orm/better-sqlite3` with `@libsql/client` + `drizzle-orm/libsql`. Provide async-compatible wrappers for the raw `sqlite` export.

### Step 4: Add `await` to database calls
Since libsql is async (unlike sync better-sqlite3), add `await` to Drizzle queries and raw SQL calls across API routes. These are all inside `async` handlers already.

### Step 5: Ensure devDependencies install on Hostinger
`@tailwindcss/postcss`, `typescript`, etc. are in devDependencies. Hostinger must install them during build.

**Total files changed: ~95 (mostly mechanical `await` additions). No framework downgrades. No component replacements. No config destruction.**

---

## Hostinger hPanel Settings

### Node.js Version
Set to **24** (or any version ≥ 20.9.0). Next.js 16.1.6 requires Node ≥ 20.9.0. Hostinger supports Node 24 — no Next.js downgrade needed.

### Build Command
```
npm install && npm run build
```
- `npm install` must install **both** dependencies and devDependencies (TypeScript, `@tailwindcss/postcss`, etc. are in devDependencies)
- If Hostinger sets `NODE_ENV=production` during install, devDependencies will be skipped and the build will fail. To fix, either:
  - Set `NODE_ENV=development` for the install step, then `NODE_ENV=production` for the build, **or**
  - Use `npm install --include=dev && npm run build`

### Start Command
```
npm start
```
This runs `next start` (defined in `package.json` scripts).

### Environment Variables
Set these in Hostinger hPanel → Website → Advanced → Node.js → Environment Variables:

| Variable | Value | Required |
|----------|-------|----------|
| `DATABASE_URL` | Turso cloud URL, e.g. `libsql://your-db-name.turso.io` | ✅ |
| `DATABASE_AUTH_TOKEN` | Turso auth token | ✅ |
| `JWT_SECRET` | Random 64+ char string for session signing | ✅ |
| `NEXT_PUBLIC_APP_URL` | Your domain, e.g. `https://hub.yourdomain.com` | ✅ |
| `NODE_ENV` | `production` (for runtime; see build note above) | ✅ |
| `SENTRY_DSN` | Sentry DSN for error tracking | Optional |
| `SENTRY_AUTH_TOKEN` | Sentry auth token for source maps | Optional |
| `VAPID_PUBLIC_KEY` | Web push VAPID public key | Optional |
| `VAPID_PRIVATE_KEY` | Web push VAPID private key | Optional |

### Database
- **Do NOT use a local file SQLite path** — Hostinger shared hosting may not persist files between deploys
- Use **Turso** (cloud-hosted libsql): create a database at [turso.tech](https://turso.tech), copy the URL and auth token
- The app uses `@libsql/client` (pure JS, no native compilation) — this is why `better-sqlite3` was removed
- All database operations are fully async

### What Was Changed for Hostinger Compatibility
1. **Removed `better-sqlite3`** (native C++ addon) — replaced with `@libsql/client` (pure JS)
2. **Rewrote `src/lib/db/index.ts`** — async wrapper for `@libsql/client` with Drizzle ORM
3. **Added `await` to all DB calls** across ~80+ API routes, lib files, socket handlers, and scripts
4. **No framework downgrades** — React 19, Next.js 16, Tailwind v4 all kept as-is
5. **No config changes** — `next.config.ts`, `postcss.config.mjs`, Sentry, PWA all preserved
