import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  getSoundscapeIntensity,
  setSoundscapeIntensity,
  playSoundscapeChime,
  type SoundscapeIntensity,
} from "./sound-effects";

// ── Mock AudioContext ──────────────────────────────────────────────

const mockOscillator = {
  type: "sine" as OscillatorType,
  frequency: {
    value: 0,
    setValueAtTime: vi.fn(),
    linearRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
  start: vi.fn(),
  stop: vi.fn(),
};

const mockGain = {
  gain: {
    value: 0,
    setValueAtTime: vi.fn(),
    exponentialRampToValueAtTime: vi.fn(),
  },
  connect: vi.fn(),
};

const mockCtx = {
  currentTime: 0,
  destination: {},
  resume: vi.fn(),
  close: vi.fn(),
  createOscillator: vi.fn(() => ({ ...mockOscillator })),
  createGain: vi.fn(() => ({
    gain: {
      value: 0,
      setValueAtTime: vi.fn(),
      exponentialRampToValueAtTime: vi.fn(),
    },
    connect: vi.fn(),
  })),
};

vi.stubGlobal("AudioContext", vi.fn(() => ({ ...mockCtx })));

// ── Tests ──────────────────────────────────────────────────────────

describe("Soundscape Intensity Storage", () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it("defaults to 'normal' when no value stored", () => {
    expect(getSoundscapeIntensity()).toBe("normal");
  });

  it("returns stored value", () => {
    setSoundscapeIntensity("subtle");
    expect(getSoundscapeIntensity()).toBe("subtle");
  });

  it("returns 'normal' for invalid stored value", () => {
    sessionStorage.setItem("hub-soundscape-intensity", "invalid");
    expect(getSoundscapeIntensity()).toBe("normal");
  });

  it("stores 'off' correctly", () => {
    setSoundscapeIntensity("off");
    expect(getSoundscapeIntensity()).toBe("off");
  });
});

describe("playSoundscapeChime", () => {
  beforeEach(() => {
    sessionStorage.clear();
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("does not play during quiet hours (23:00-05:00)", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 23, 30)); // 23:30
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("night", "task-due");
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("does not play during quiet hours (03:00)", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 3, 0)); // 03:00
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("night", "task-completed");
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("plays at 05:00 (outside quiet hours)", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 5, 0)); // 05:00
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("dawn", "task-completed");
    expect(ctorSpy).toHaveBeenCalled();
  });

  it("does not play when intensity is 'off'", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    setSoundscapeIntensity("off");
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("morning", "task-due");
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("skips 'task-due' in subtle mode", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    setSoundscapeIntensity("subtle");
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("morning", "task-due");
    expect(ctorSpy).not.toHaveBeenCalled();
  });

  it("plays 'task-completed' in subtle mode", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    setSoundscapeIntensity("subtle");
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("morning", "task-completed");
    expect(ctorSpy).toHaveBeenCalled();
  });

  it("plays 'task-overdue' in subtle mode", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    setSoundscapeIntensity("subtle");
    const ctorSpy = vi.mocked(AudioContext);
    ctorSpy.mockClear();

    playSoundscapeChime("morning", "task-overdue");
    expect(ctorSpy).toHaveBeenCalled();
  });

  it("plays all events in normal mode", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 10, 0));
    setSoundscapeIntensity("normal");
    const ctorSpy = vi.mocked(AudioContext);

    const events = ["task-due", "task-completed", "task-overdue"] as const;
    for (const event of events) {
      ctorSpy.mockClear();
      playSoundscapeChime("morning", event);
      expect(ctorSpy).toHaveBeenCalled();
    }
  });

  it("plays for all day phases without error", () => {
    vi.setSystemTime(new Date(2026, 0, 1, 12, 0));
    setSoundscapeIntensity("normal");

    const phases = ["dawn", "morning", "midday", "afternoon", "evening", "night"] as const;
    for (const phase of phases) {
      expect(() => playSoundscapeChime(phase, "task-due")).not.toThrow();
      expect(() => playSoundscapeChime(phase, "task-completed")).not.toThrow();
      expect(() => playSoundscapeChime(phase, "task-overdue")).not.toThrow();
    }
  });
});
