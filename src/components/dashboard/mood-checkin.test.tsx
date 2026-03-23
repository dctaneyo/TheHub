import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { MoodCheckinPrompt } from "./mood-checkin";

// Mock framer-motion
vi.mock("framer-motion", () => ({
  motion: {
    div: ({ children, ...props }: React.PropsWithChildren<Record<string, unknown>>) => {
      const { initial, animate, exit, transition, whileHover, whileTap, ...rest } = props as any;
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
    Object.keys(mockSessionStorage).forEach(k => delete mockSessionStorage[k]);
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

  it("renders five emoji buttons for location user", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    expect(screen.getByLabelText("Mood: Terrible")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Bad")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Okay")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Good")).toBeTruthy();
    expect(screen.getByLabelText("Mood: Amazing")).toBeTruthy();
  });

  it("has aria-label on each emoji button", () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);
    const buttons = screen.getAllByRole("button");
    expect(buttons).toHaveLength(5);
    expect(buttons[0]).toHaveAttribute("aria-label", "Mood: Terrible");
    expect(buttons[4]).toHaveAttribute("aria-label", "Mood: Amazing");
  });

  it("calls POST /api/mood-checkins on emoji tap", async () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);

    fireEvent.click(screen.getByLabelText("Mood: Good"));

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith("/api/mood-checkins", expect.objectContaining({
        method: "POST",
        body: JSON.stringify({ moodScore: 4 }),
      }));
    });
  });

  it("sets sessionStorage flag after submission", async () => {
    mockUser.mockReturnValue({ id: "loc-1", userType: "location", tenantId: "kazi", name: "Loc" });
    render(<MoodCheckinPrompt />);

    fireEvent.click(screen.getByLabelText("Mood: Okay"));

    await waitFor(() => {
      expect(window.sessionStorage.setItem).toHaveBeenCalledWith("hub-mood-checked", "true");
    });
  });
});
