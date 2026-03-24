import { describe, it, expect } from "vitest";
import { ANIMATION, TOUCH_TARGETS, getTransition, getSpringTransition } from "./animation-constants";

describe("ANIMATION constants", () => {
  it("defines page transition at 200ms", () => {
    expect(ANIMATION.pageTransition.duration).toBe(0.2);
  });

  it("defines card press at 150ms with scale 0.98", () => {
    expect(ANIMATION.cardPress.duration).toBe(0.15);
    expect(ANIMATION.cardPress.scale).toBe(0.98);
  });

  it("defines list stagger at 30ms per item", () => {
    expect(ANIMATION.listStagger.delayPerItem).toBe(0.03);
  });

  it("defines task completion at 400ms spring", () => {
    expect(ANIMATION.taskCompletion.duration).toBe(0.4);
    expect(ANIMATION.taskCompletion.type).toBe("spring");
  });

  it("defines hub menu slide at 200ms ease-out", () => {
    expect(ANIMATION.hubMenuSlide.duration).toBe(0.2);
    expect(ANIMATION.hubMenuSlide.ease).toBe("easeOut");
  });

  it("defines bottom sheet spring(300, 30)", () => {
    expect(ANIMATION.bottomSheet.type).toBe("spring");
    expect(ANIMATION.bottomSheet.stiffness).toBe(300);
    expect(ANIMATION.bottomSheet.damping).toBe(30);
  });

  it("defines XP bar fill spring(100, 20)", () => {
    expect(ANIMATION.xpBarFill.type).toBe("spring");
    expect(ANIMATION.xpBarFill.stiffness).toBe(100);
    expect(ANIMATION.xpBarFill.damping).toBe(20);
  });

  it("defines badge unlock at 2000ms spring", () => {
    expect(ANIMATION.badgeUnlock.duration).toBe(2);
    expect(ANIMATION.badgeUnlock.type).toBe("spring");
  });
});

describe("TOUCH_TARGETS constants", () => {
  it("defines icon touch target at 40px minimum", () => {
    expect(TOUCH_TARGETS.icon).toBe(40);
  });

  it("defines primary action touch target at 64px minimum", () => {
    expect(TOUCH_TARGETS.primaryAction).toBe(64);
  });
});

describe("getTransition", () => {
  it("returns duration 0 when reduced motion is true", () => {
    const result = getTransition(true, { duration: 0.5, ease: "easeOut" });
    expect(result).toEqual({ duration: 0 });
  });

  it("returns original transition when reduced motion is false", () => {
    const transition = { duration: 0.5, ease: "easeOut" };
    const result = getTransition(false, transition);
    expect(result).toEqual(transition);
  });
});

describe("getSpringTransition", () => {
  it("returns duration 0 when reduced motion is true", () => {
    const result = getSpringTransition(true, { stiffness: 300, damping: 30 });
    expect(result).toEqual({ duration: 0 });
  });

  it("returns spring transition when reduced motion is false", () => {
    const result = getSpringTransition(false, { stiffness: 300, damping: 30 });
    expect(result).toEqual({ type: "spring", stiffness: 300, damping: 30 });
  });

  it("uses default stiffness/damping when not provided", () => {
    const result = getSpringTransition(false);
    expect(result).toEqual({ type: "spring", stiffness: 300, damping: 30 });
  });
});
