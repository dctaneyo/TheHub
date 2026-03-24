import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: Record<string, unknown>) => {
      const { layoutId, transition, ...rest } = props as Record<string, unknown>;
      return (
        <div data-testid="nav-dot" data-layout-id={layoutId as string} {...rest}>
          {children as React.ReactNode}
        </div>
      );
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

import { BottomNav } from "./bottom-nav";

const baseProps = {
  activeTab: "tasks",
  onTabChange: vi.fn(),
  onOpenChat: vi.fn(),
  onOpenMood: vi.fn(),
  onOpenCalendar: vi.fn(),
  onOpenMenu: vi.fn(),
};

describe("BottomNav", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders all 5 tabs", () => {
    render(<BottomNav {...baseProps} />);
    expect(screen.getByLabelText("Tasks")).toBeInTheDocument();
    expect(screen.getByLabelText("Chat")).toBeInTheDocument();
    expect(screen.getByLabelText("Mood")).toBeInTheDocument();
    expect(screen.getByLabelText("Calendar")).toBeInTheDocument();
    expect(screen.getByLabelText("Menu")).toBeInTheDocument();
  });

  it("renders as a nav with tablist role", () => {
    render(<BottomNav {...baseProps} />);
    const nav = screen.getByRole("tablist", { name: "Main navigation" });
    expect(nav).toBeInTheDocument();
  });

  it("applies h-16 height and sm:hidden classes", () => {
    render(<BottomNav {...baseProps} />);
    const nav = screen.getByRole("tablist");
    expect(nav).toHaveClass("h-16");
    expect(nav).toHaveClass("sm:hidden");
  });

  it("applies frosted glass treatment", () => {
    render(<BottomNav {...baseProps} />);
    const nav = screen.getByRole("tablist");
    expect(nav).toHaveClass("bg-white/5");
    expect(nav).toHaveClass("backdrop-blur-xl");
    expect(nav).toHaveClass("border-t");
    expect(nav).toHaveClass("border-white/10");
  });

  it("marks active tab with aria-selected=true", () => {
    render(<BottomNav {...baseProps} activeTab="tasks" />);
    expect(screen.getByLabelText("Tasks")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Chat")).toHaveAttribute("aria-selected", "false");
  });

  it("renders dot indicator only for active tab", () => {
    render(<BottomNav {...baseProps} activeTab="tasks" />);
    const dots = screen.getAllByTestId("nav-dot");
    expect(dots).toHaveLength(1);
    expect(dots[0]).toHaveAttribute("data-layout-id", "bottom-nav-dot");
  });

  it("ensures all touch targets are at least 40px", () => {
    render(<BottomNav {...baseProps} />);
    const tabs = screen.getAllByRole("tab");
    tabs.forEach((tab) => {
      expect(tab).toHaveClass("min-w-[40px]");
      expect(tab).toHaveClass("min-h-[40px]");
    });
  });

  it("calls onTabChange when Tasks tab is clicked", () => {
    render(<BottomNav {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Tasks"));
    expect(baseProps.onTabChange).toHaveBeenCalledWith("tasks");
  });

  it("calls onOpenChat when Chat tab is clicked", () => {
    render(<BottomNav {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Chat"));
    expect(baseProps.onOpenChat).toHaveBeenCalled();
  });

  it("calls onOpenMood when Mood tab is clicked", () => {
    render(<BottomNav {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Mood"));
    expect(baseProps.onOpenMood).toHaveBeenCalled();
  });

  it("calls onOpenCalendar when Calendar tab is clicked", () => {
    render(<BottomNav {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Calendar"));
    expect(baseProps.onOpenCalendar).toHaveBeenCalled();
  });

  it("dispatches mirror:panel-change event and calls onOpenMenu when Menu tab is clicked", () => {
    const dispatchSpy = vi.spyOn(window, "dispatchEvent");
    render(<BottomNav {...baseProps} />);
    fireEvent.click(screen.getByLabelText("Menu"));

    const panelEvent = dispatchSpy.mock.calls.find(
      (call) =>
        (call[0] as CustomEvent).type === "mirror:panel-change" &&
        (call[0] as CustomEvent).detail?.hubMenuOpen === true
    );
    expect(panelEvent).toBeTruthy();
    expect(baseProps.onOpenMenu).toHaveBeenCalled();

    dispatchSpy.mockRestore();
  });

  it("moves dot indicator when active tab changes", () => {
    const { rerender } = render(<BottomNav {...baseProps} activeTab="tasks" />);
    expect(screen.getByLabelText("Tasks")).toHaveAttribute("aria-selected", "true");

    rerender(<BottomNav {...baseProps} activeTab="chat" />);
    expect(screen.getByLabelText("Chat")).toHaveAttribute("aria-selected", "true");
    expect(screen.getByLabelText("Tasks")).toHaveAttribute("aria-selected", "false");
  });
});
