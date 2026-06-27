"use client";

import Link from "next/link";
import { ArrowLeft, CheckSquare, MessageCircle, Calendar } from "@/lib/icons";
import { IconTip } from "@/components/ui/icon-tip";
import { useDeviceType } from "@/hooks/use-device-type";
import { useInactivityRedirect } from "@/hooks/use-inactivity-redirect";
import { InactivityWarning } from "@/components/inactivity-warning";

/**
 * Shared header for the "full version" routes (/tasks, /messages,
 * /calendar) — back-to-dashboard plus quick links between siblings, so
 * moving between them doesn't require round-tripping through the dashboard
 * every time. Deliberately NOT rendered on /dashboard itself — the
 * dashboard stays the nav-free ambient surface; this only shows up once
 * you've actually left it. Not a sidebar, not a persistent nav rail: just
 * a slim, consistent strip matching every other header in this app
 * (icon + title left, h-14, border-b).
 *
 * Also the single mounting point for the kiosk inactivity-redirect timer
 * (see use-inactivity-redirect.ts) — every page that renders this header
 * gets it automatically, kiosk/desktop only, never mobile (no idle-kiosk
 * risk on a personal phone) and never ARL (this header doesn't render
 * there at all).
 */

const SIBLINGS: { href: string; label: string; icon: typeof CheckSquare }[] = [
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

export function SubPageHeader({
  title,
  icon: Icon,
  currentPath,
  children,
}: {
  title: string;
  icon: typeof CheckSquare;
  currentPath: string;
  /** Optional page-specific controls (e.g. a date picker) rendered on the right, before the sibling links. */
  children?: React.ReactNode;
}) {
  const isMobile = useDeviceType() === "mobile";
  const { warning, secondsLeft } = useInactivityRedirect(!isMobile);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          <IconTip label="Back to Dashboard">
            <Link
              href="/dashboard"
              className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
          </IconTip>
          <div className="flex items-center gap-2">
            <Icon className="h-4 w-4 text-primary" />
            <h1 className="text-lg font-semibold text-foreground">{title}</h1>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {children}
          <div className="flex items-center gap-1">
            {SIBLINGS.filter((s) => s.href !== currentPath).map((s) => (
              <IconTip key={s.href} label={s.label}>
                <Link
                  href={s.href}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
                >
                  <s.icon className="h-4 w-4" />
                </Link>
              </IconTip>
            ))}
          </div>
        </div>
      </header>
      <InactivityWarning show={warning} secondsLeft={secondsLeft} />
    </>
  );
}
