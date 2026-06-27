"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { useAuth } from "@/lib/auth-context";
import { useDeviceType } from "@/hooks/use-device-type";
import { useInactivityRedirect } from "@/hooks/use-inactivity-redirect";
import { InactivityWarning } from "@/components/inactivity-warning";
import { ConnectionStatus } from "@/components/connection-status";
import { IconTip } from "@/components/ui/icon-tip";
import { HubMark } from "@/components/icons/hub-mark";
import { ArrowLeft, LogOut, Sun, Moon, Monitor, CheckSquare, MessageCircle, Calendar } from "@/lib/icons";

/**
 * The one app header — same bar (logo or back+title, clock, connection,
 * theme, sign out) on every full-page route, dashboard included, so leaving
 * the dashboard for /tasks, /messages or /calendar never feels like leaving
 * the app into a different, thinner shell. `backHref` switches the left
 * side from the logo+username identity block to a back arrow + page
 * icon/title; everything on the right stays the same either way.
 *
 * Also the single mounting point for the kiosk inactivity-redirect timer —
 * active on sub-pages only (kiosk/desktop, never mobile): there's nothing to
 * time out *from* on the dashboard itself.
 */

function HeaderClockDisplay() {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  const time = now.toLocaleTimeString([], { hour: "numeric", minute: "2-digit", second: "2-digit" });
  return (
    <span className="font-mono text-sm font-semibold tabular-nums text-muted-foreground" aria-label="Current time">
      {time}
    </span>
  );
}

const SIBLINGS: { href: string; label: string; icon: typeof CheckSquare }[] = [
  { href: "/tasks", label: "Tasks", icon: CheckSquare },
  { href: "/messages", label: "Messages", icon: MessageCircle },
  { href: "/calendar", label: "Calendar", icon: Calendar },
];

export function AppHeader({
  title,
  icon: Icon,
  backHref,
  currentPath,
  hasClockWidget,
  settingsSlot,
  children,
}: {
  title: string;
  /** Page icon, shown next to the title on sub-pages only (dashboard keeps the logo mark). */
  icon?: typeof CheckSquare;
  /** Presence of this prop is what switches the header from "dashboard identity" to "sub-page nav". */
  backHref?: string;
  /** Used to filter the current page out of the sibling quick-links. */
  currentPath?: string;
  /** Dashboard-only: hides the header clock when the Clock widget is already on the grid. */
  hasClockWidget?: boolean;
  /** Dashboard-only: the widget-customize cog (needs a GridProvider, so it can't live in here). */
  settingsSlot?: React.ReactNode;
  /** Page-specific controls (e.g. Tasks' date nav), rendered before the status group. */
  children?: React.ReactNode;
}) {
  const { user, logout } = useAuth();
  const { theme, setTheme } = useTheme();
  const deviceType = useDeviceType();
  const isMobile = deviceType === "mobile";
  const isSubpage = !!backHref;
  const { warning, secondsLeft } = useInactivityRedirect(isSubpage && !isMobile);

  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const themeLabel = theme ? theme[0].toUpperCase() + theme.slice(1) : "System";

  const cycleTheme = useCallback(() => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }, [theme, setTheme]);

  return (
    <>
      <header className="flex h-14 shrink-0 items-center justify-between gap-2 border-b border-border px-4">
        <div className="flex items-center gap-2.5">
          {isSubpage ? (
            <>
              <IconTip label="Back to Dashboard">
                <Link
                  href={backHref}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                </Link>
              </IconTip>
              <div className="flex items-center gap-2">
                {Icon && <Icon className="h-4 w-4 text-primary" />}
                <h1 className="text-lg font-semibold text-foreground">{title}</h1>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[var(--hub-red)] text-white">
                <HubMark className="h-3.5 w-3.5" />
              </div>
              {/* Location name as the primary identity — same prominence "Dashboard"
                  had before (Body/Semibold). Store number inline at Caption weight,
                  smaller + lower contrast per Section 7 two-signal subordination. */}
              {user?.name && (
                <h1 className="text-sm font-semibold text-foreground leading-none">{user.name}</h1>
              )}
              {user?.storeNumber && (
                <span className="text-xs text-muted-foreground leading-none">#{user.storeNumber}</span>
              )}
            </div>
          )}
        </div>

        {/* Two groups with a wider gap between them than within each —
            status/disclosure (clock, connection, settings, siblings) vs.
            direct actions (theme, sign out). */}
        <div className="flex items-center gap-4">
          {children}
          <div className="flex items-center gap-2">
            {!hasClockWidget && (
              <div className="flex h-9 items-center px-2">
                <HeaderClockDisplay />
              </div>
            )}
            <ConnectionStatus />
            {settingsSlot}
            {isSubpage && (
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
            )}
          </div>
          <div className="flex items-center gap-2">
            {themeMounted && (
              <IconTip label={`Theme: ${themeLabel}`}>
                <button
                  type="button"
                  onClick={cycleTheme}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted"
                >
                  {theme === "dark" ? <Moon className="h-3.5 w-3.5" /> : theme === "light" ? <Sun className="h-3.5 w-3.5" /> : <Monitor className="h-3.5 w-3.5" />}
                </button>
              </IconTip>
            )}
            {isMobile ? (
              <IconTip label="Sign Out">
                <button
                  type="button"
                  onClick={() => logout()}
                  className="flex h-9 w-9 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted active:text-foreground"
                >
                  <LogOut className="h-3.5 w-3.5" />
                </button>
              </IconTip>
            ) : (
              <button type="button" onClick={() => logout()}
                className="flex h-9 items-center gap-1 rounded-full px-2 text-xs font-semibold text-muted-foreground active:bg-muted active:text-foreground">
                <LogOut className="h-3.5 w-3.5" />
                <span>Sign Out</span>
              </button>
            )}
          </div>
        </div>
      </header>
      <InactivityWarning show={warning} secondsLeft={secondsLeft} />
    </>
  );
}
