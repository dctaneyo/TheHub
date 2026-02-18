# The Hub - Franchise Management Dashboard

An all-in-one dashboard solution for franchise restaurant operations. Designed to run 24/7 on touchscreen kiosks in Chrome Kiosk mode, with a separate responsive interface for Above Restaurant Leaders (ARLs).

## Features

- **PinPad Login** — 6-digit User ID + 6-digit PIN, auto-detects restaurant vs ARL
- **Restaurant Dashboard** — Fullscreen, no-scroll layout with vertical task timeline, mini calendar (7-day lookahead), completed/missed tasks, and points tracker
- **Task Management** — Create, edit, and assign recurring or one-time tasks/reminders/cleaning tasks to locations
- **Instant Messaging** — Real-time chat between restaurants and ARLs with read receipts
- **Notifications** — Audible alerts for due-soon and overdue tasks
- **Gamification** — Points system with confetti animations on task completion
- **Session Tracking** — ARLs can monitor which locations are online/offline
- **Connection Indicator** — Auto-reconnect with visual status
- **ARL Hub** — Responsive layout (desktop/tablet/mobile) for management functions
- **Custom Onscreen Keyboard** — iPadOS-inspired with emoji picker
- **Forms Repository** — PDF upload and distribution (placeholder)

## Tech Stack

- **Next.js 16** (App Router) + TypeScript
- **TailwindCSS v4** + shadcn/ui
- **SQLite** via better-sqlite3 + Drizzle ORM
- **Framer Motion** for animations
- **bcryptjs** + **jsonwebtoken** for auth

## Getting Started

```bash
# Install dependencies
npm install

# Seed the database with demo data
npm run db:seed

# Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Demo Credentials

| Role | User ID | PIN |
|------|---------|-----|
| Admin | 000001 | 123456 |
| ARL (Jane) | 000002 | 123456 |
| Downtown | 100001 | 111111 |
| Westside | 100002 | 222222 |
| Airport | 100003 | 333333 |

## Environment Variables

Copy `.env.example` to `.env.local` and configure:

```
JWT_SECRET=your-secret-key-here
DATABASE_PATH=./data/hub.db
```

## Deploy on Railway

1. Push to a Git repository
2. Connect the repo to Railway
3. Add a persistent volume mounted at `/data`
4. Set environment variables: `JWT_SECRET`, `DATABASE_PATH=/data/hub.db`, `NODE_ENV=production`
5. Railway will auto-detect the `railway.toml` config

## Project Structure

```
src/
  app/
    login/          # PinPad login page
    dashboard/      # Restaurant fullscreen dashboard
    arl/            # ARL management hub
    api/
      auth/         # Login, logout, session check
      tasks/        # CRUD, today, complete, upcoming
      locations/    # Location management + status
      messages/     # Messaging + read receipts
  components/
    dashboard/      # Timeline, mini-calendar, completed/missed, notifications, chat
    arl/            # Task manager, locations manager, messaging
    ui/             # shadcn/ui components
    confetti.tsx    # Gamification particle animations
    connection-status.tsx
    onscreen-keyboard.tsx
  lib/
    db/             # Schema, database connection, seed script
    auth.ts         # JWT helpers
    auth-context.tsx # Client-side auth provider
```
