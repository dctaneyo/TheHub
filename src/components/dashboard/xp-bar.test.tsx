import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";

// Mock socket context
const mockSocket = {
  on: vi.fn(),
  off: vi.fn(),
  emit: vi.fn(),
};
vi.mock("@/lib/socket-context", () => ({
  useSocket: () => ({ socket: mockSocket }),
}));

// Mock framer-motion — render motion.div as a plain div with style for width
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, animate, initial, transition, ...props }: Record<string, unknown>) => {
      const style = typeof animate === "object" ? (animate as Record<string, string>) : {};
      return <div data-testid="xp-fill" style={style} {...props}>{children as React.ReactNode}</div>;
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

// Mock layout context
vi.mock("@/lib/layout-context", () => ({
  useLayout: () => ({ layout: "classic", setLayout: vi.fn() }),
  LAYOUT_OPTIONS: [
    { id: "classic", name: "Classic" },
    { id: "focus", name: "Focus" },
    { id: "pulse", name: "Pulse" },
  ],
}));

// Mock sub-components used by MinimalHeader
vi.mock("@/components/connection-status", () => ({
  ConnectionStatus: () => <div data-testid="connection-status" />,
}));
vi.mock("@/components/notification-bell", () => ({
  NotificationBell: () => <div data-testid="notification-bell" />,
}));
vi.mock("@/components/dashboard/gamification-hub", () => ({
  GamificationHub: () => <div data-testid="gamification-hub" />,
}));
vi.mock("@/components/theme-toggle", () => ({
  ThemeToggle: () => <div data-testid="theme-toggle" />,
}));
vi.mock("@/components/dashboard/soundscape-intensity-selector", () => ({
  SoundscapeIntensitySelector: () => <div data-testid="soundscape-intensity" />,
}));

import { MinimalHeader } from "./minimal-header";

const baseProps = {
  user: { id: "loc1", name: "Test Store", storeNumber: "1234", userType: "location" },
  displayTime: "10:30 AM",
  allTasks: [],
  currentTime: "10:30",
  soundEnabled: true,
  onToggleSound: vi.fn(),
  screensaverEnabled: true,
  onToggleScreensaver: vi.fn(),
  onShowScreensaver: vi.fn(),
  chatOpen: false,
  onToggleChat: vi.fn(),
  chatUnread: 0,
  onOpenForms: vi.fn(),
  onOpenCalendar: vi.fn(),
  onLogout: vi.fn(),
  effectiveLocationId: "loc1",
};

describe("XP Bar", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    global.fetch = vi.fn();
  });

  it("renders the XP bar element under the header", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 50 } }),
    });

    render(<MinimalHeader {...baseProps} />);
    const xpBar = screen.getByLabelText("XP progress bar — tap to open profile");
    expect(xpBar).toBeInTheDocument();
    expect(xpBar).toHaveClass("h-[3px]");
    expect(xpBar).toHaveClass("sticky");
    expect(xpBar).toHaveClass("top-14");
    expect(xpBar).toHaveClass("z-[99]");
  });

  it("fetches XP data from gamification API with locationId", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 75 } }),
    });

    render(<MinimalHeader {...baseProps} />);

    await waitFor(() => {
      const calls = (global.fetch as ReturnType<typeof vi.fn>).mock.calls;
      const gamCall = calls.find((c: string[]) => c[0]?.includes("/api/gamification"));
      expect(gamCall).toBeTruthy();
      expect(gamCall![0]).toContain("locationId=loc1");
    });
  });

  it("animates fill width to match progress percentage", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 65 } }),
    });

    render(<MinimalHeader {...baseProps} />);

    await waitFor(() => {
      const fill = screen.getByTestId("xp-fill");
      expect(fill).toHaveStyle({ width: "65%" });
    });
  });

  it("renders at 0% when API fails", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
    });

    render(<MinimalHeader {...baseProps} />);

    // Should stay at 0% — the initial state
    const fill = screen.getByTestId("xp-fill");
    expect(fill).toHaveStyle({ width: "0%" });
  });

  it("dispatches gamificationOpen event on click", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 50 } }),
    });

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<MinimalHeader {...baseProps} />);
    const xpBar = screen.getByLabelText("XP progress bar — tap to open profile");
    fireEvent.click(xpBar);

    const panelEvent = dispatchSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent).type === "mirror:panel-change" &&
        (call[0] as CustomEvent).detail?.gamificationOpen === true
    );
    expect(panelEvent).toBeTruthy();

    dispatchSpy.mockRestore();
  });

  it("dispatches gamificationOpen event on Enter key", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 50 } }),
    });

    const dispatchSpy = vi.spyOn(window, "dispatchEvent");

    render(<MinimalHeader {...baseProps} />);
    const xpBar = screen.getByLabelText("XP progress bar — tap to open profile");
    fireEvent.keyDown(xpBar, { key: "Enter" });

    const panelEvent = dispatchSpy.mock.calls.find(
      (call) => (call[0] as CustomEvent).type === "mirror:panel-change" &&
        (call[0] as CustomEvent).detail?.gamificationOpen === true
    );
    expect(panelEvent).toBeTruthy();

    dispatchSpy.mockRestore();
  });

  it("subscribes to socket events for live XP updates", () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ level: { progress: 50 } }),
    });

    render(<MinimalHeader {...baseProps} />);

    const onCalls = mockSocket.on.mock.calls.map((c: string[]) => c[0]);
    expect(onCalls).toContain("task:completed");
    expect(onCalls).toContain("task:updated");
    expect(onCalls).toContain("leaderboard:updated");
  });
});
