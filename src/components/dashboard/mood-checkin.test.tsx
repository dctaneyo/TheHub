import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { MoodCheckinPrompt } from "./mood-checkin";

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
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, drag, dragConstraints, onDragEnd, layoutId, ...rest } = props as any;
      return <div {...rest}>{children}</div>;
    },
    button: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props as any;
      return <button {...rest}>{children}</button>;
    },
  },
  AnimatePresence: ({ children }: React.PropsWithChildren) => <>{children}</>,
}));

// Mock auth context
const mockUser = vi.fn();
vi.mock("@/lib/auth-context", () => ({
  useAuth: () => ({ user: mockUser() }),
}));

// Mock fetch
const mockFetch = vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve({ ok: true, id: "test" }) }));
global.fetch = mockFetch as any;

// Mock sessionStorage
const mockSessionStorage: Record<string, string> = {};
Object.defineProperty(window, "sessionStorage", {
  value: {
    getItem: vi.fn((key: string) => mockSessionStorage[key] || null),
    setItem: vi.fn((key: string, value: string) => { mockSessionStorage[key] = value; }),
    removeItem: vi.fn((key: string) => { delete mockSessionStorage[key]; }),
    clear: vi.fn(() => { Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]); }),
  },
  writable: true,
});

describe("MoodCheckinPrompt", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when user is null", () => {
    mockUser.mockReturnValue(null);
    const { container } = render(<MoodCheckinPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when user is ARL", () => {
    mockUser.mockReturnValue({ id: "arl-1", userType: "arl", tenantId: "kazi", name: "ARL" });
    const { container } = render(<MoodCheckinPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("renders nothing when session flag is already set", () => {
    mockSessionStorage["hub-mood-checked"] = "true";
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    const { container } = render(<MoodCheckinPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("does not render immediately — waits 5 minutes after login", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    const { container } = render(<MoodCheckinPrompt />);
    // Should not be visible yet
    expect(container.innerHTML).toBe("");
  });

  it("renders five emoji buttons after 5-minute delay", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);

    // Advance past the 5-minute delay
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    expect(screen.getByLabelText("Mood: Terrible")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Bad")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Okay")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Good")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Amazing")).toBeTruthy();
  });

  it("has aria-label on each emoji button", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    // 5 emoji buttons + 1 dismiss button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThanOrEqual(5);
    expect(screen.getByLabelText("Mood: Terrible")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Amazing")).toBeTruthy();
  });

  it("calls POST /api/mood-checkins on emoji tap", async () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Mood: Good"));
    });

    expect(mockFetch).toHaveBeenCalledWith("/api/mood-checkins", expect.objectContaining({
      method: "POST",
      body: JSON.stringify({ moodScore: 4 }),
    }));
  });

  it("sets sessionStorage flag after submission", async () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    await act(async () => {
      fireEvent.click(screen.getByLabelText("Mood: Okay"));
    });

    expect(window.sessionStorage.setItem).toHaveBeenCalledWith("hub-mood-checked", "true");
  });

  it("renders as non-blocking card (no overlay backdrop)", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    const { container } = render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    // Should not have a full-screen backdrop overlay
    const backdrop = container.querySelector(".fixed.inset-0.bg-black\\/30");
    expect(backdrop).toBeNull();
  });

  it("has a dismiss button", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    expect(screen.getByLabelText("Dismiss mood check-in")).toBeTruthy();
  });

  it("displays text labels under emojis", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    expect(screen.getByText("Terrible")).toBeTruthy();
    expect(screen.getByText("Good")).toBeTruthy();
    expect(screen.getByText("Amazing")).toBeTruthy();
  });

  it("suppresses after second dismiss", () => {
    mockSessionStorage["hub-mood-dismiss-count"] = "2";
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    const { container } = render(<MoodCheckinPrompt />);
    act(() => { vi.advanceTimersByTime(5 * 60 * 1000); });

    expect(container.innerHTML).toBe("");
  });
});
