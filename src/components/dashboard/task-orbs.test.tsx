import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { TaskOrbs } from "./task-orbs";
import type { TaskItem } from "./timeline";

// Mock matchMedia
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: vi.fn().mockImplementation((query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    button: ({
      children,
      "aria-label": ariaLabel,
      onClick,
      ...rest
    }: React.PropsWithChildren<Record<string, unknown>>) => (
      <button aria-label={ariaLabel as string} onClick={onClick as React.MouseEventHandler}>
        {children}
      </button>
    ),
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <div>{children}</div>
    ),
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

const makeTasks = (overrides: Partial<TaskItem>[] = []): TaskItem[] => {
  const defaults: TaskItem = {
    id: "1",
    title: "Clean fryer",
    description: "Deep clean the fryer",
    type: "cleaning",
    priority: "normal",
    dueTime: "14:30",
    points: 10,
    isCompleted: false,
    isOverdue: false,
    isDueSoon: false,
  };
  if (overrides.length === 0) return [defaults];
  return overrides.map((o, i) => ({ ...defaults, id: String(i + 1), ...o }));
};

describe("TaskOrbs", () => {
  it("renders orb buttons with aria-label including task title and status", () => {
    render(
      <TaskOrbs
        tasks={makeTasks([{ title: "Clean fryer", dueTime: "14:30" }])}
        currentTime="12:00"
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Task: Clean fryer/ });
    expect(btn).toBeTruthy();
    expect(btn.getAttribute("aria-label")).toContain("due at 2:30 PM");
    expect(btn.getAttribute("aria-label")).toContain("pending");
  });

  it("aria-label shows 'overdue' for overdue tasks", () => {
    render(
      <TaskOrbs
        tasks={makeTasks([{ title: "Mop floors", isOverdue: true, dueTime: "10:00" }])}
        currentTime="12:00"
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Task: Mop floors/ });
    expect(btn.getAttribute("aria-label")).toContain("overdue");
  });

  it("aria-label shows 'completed' for completed tasks", () => {
    render(
      <TaskOrbs
        tasks={makeTasks([{ title: "Wipe tables", isCompleted: true, dueTime: "09:00" }])}
        currentTime="12:00"
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    const btn = screen.getByRole("button", { name: /Task: Wipe tables/ });
    expect(btn.getAttribute("aria-label")).toContain("completed");
  });

  it("accepts optional dayPhase prop without error", () => {
    const { container } = render(
      <TaskOrbs
        tasks={makeTasks()}
        currentTime="12:00"
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
        dayPhase="evening"
      />,
    );
    expect(container.querySelector("button")).toBeTruthy();
  });

  it("renders without dayPhase prop (backward compatible)", () => {
    const { container } = render(
      <TaskOrbs
        tasks={makeTasks()}
        currentTime="12:00"
        onComplete={vi.fn()}
        onUncomplete={vi.fn()}
      />,
    );
    expect(container.querySelector("button")).toBeTruthy();
  });
});
