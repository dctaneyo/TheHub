import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { Heartbeat } from "./heartbeat";

// Mock framer-motion to avoid animation issues in tests
vi.mock("framer-motion", () => ({
  motion: {
    span: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => (
      <span {...props}>{children}</span>
    ),
  },
}));

// Mock canvas getContext
HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
  clearRect: vi.fn(),
  beginPath: vi.fn(),
  arc: vi.fn(),
  stroke: vi.fn(),
  fill: vi.fn(),
  moveTo: vi.fn(),
  lineTo: vi.fn(),
  closePath: vi.fn(),
  createRadialGradient: vi.fn(() => ({
    addColorStop: vi.fn(),
  })),
  scale: vi.fn(),
  set strokeStyle(_v: string) {},
  set fillStyle(_v: string | CanvasGradient) {},
  set globalAlpha(_v: number) {},
  set lineWidth(_v: number) {},
})) as unknown as typeof HTMLCanvasElement.prototype.getContext;

const baseProps = {
  health: 85,
  overdueCount: 1,
  dueSoonCount: 2,
  pointsToday: 120,
  streak: 5,
};

describe("Heartbeat", () => {
  it("renders canvas with aria-label describing health", () => {
    render(<Heartbeat {...baseProps} />);
    const canvas = screen.getByRole("img");
    expect(canvas).toHaveAttribute(
      "aria-label",
      "Location health: 85%. 1 overdue task. 2 due soon."
    );
  });

  it("aria-label uses plural for multiple overdue tasks", () => {
    render(<Heartbeat {...baseProps} overdueCount={3} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("3 overdue tasks.");
  });

  it("aria-label shows 'All tasks on track' when no overdue or due soon", () => {
    render(<Heartbeat {...baseProps} overdueCount={0} dueSoonCount={0} />);
    const canvas = screen.getByRole("img");
    expect(canvas.getAttribute("aria-label")).toContain("All tasks on track.");
  });

  it("accepts optional dayPhase prop without error", () => {
    const { container } = render(<Heartbeat {...baseProps} dayPhase="dawn" />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });

  it("renders without dayPhase prop (backward compatible)", () => {
    const { container } = render(<Heartbeat {...baseProps} />);
    expect(container.querySelector("canvas")).toBeTruthy();
  });
});
