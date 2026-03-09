"use client";

import type { Socket } from "socket.io-client";
import type { CapturedElement, DOMSnapshot, RemoteAction } from "./socket-handlers/types";

/**
 * Remote DOM Capture & Action Executor for kiosk locations.
 * Captures interactive elements + layout, streams to ARL via Socket.io.
 * Executes remote actions from ARL when control mode is enabled.
 */

// ── DOM Capture ──

function getUniqueSelector(el: Element): string {
  if (el.id) return `#${el.id}`;

  const parts: string[] = [];
  let current: Element | null = el;
  while (current && current !== document.body) {
    let selector = current.tagName.toLowerCase();
    if (current.id) {
      parts.unshift(`#${current.id}`);
      break;
    }
    if (current.className && typeof current.className === "string") {
      const cls = current.className
        .split(/\s+/)
        .filter(c => c && !c.startsWith("__") && c.length < 40)
        .slice(0, 2)
        .map(c => `.${c}`)
        .join("");
      if (cls) selector += cls;
    }
    const parent: Element | null = current.parentElement;
    if (parent) {
      const siblings = Array.from(parent.children).filter(
        (c: Element) => c.tagName === current!.tagName
      );
      if (siblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += `:nth-of-type(${index})`;
      }
    }
    parts.unshift(selector);
    current = parent;
  }
  return parts.join(" > ");
}

function isInteractive(el: Element): boolean {
  const tag = el.tagName.toLowerCase();
  if (["a", "button", "input", "textarea", "select", "details", "summary"].includes(tag)) return true;
  if (el.getAttribute("role") === "button") return true;
  if (el.getAttribute("tabindex") !== null) return true;
  if (el.getAttribute("onclick") !== null) return true;
  const cursor = window.getComputedStyle(el).cursor;
  if (cursor === "pointer") return true;
  return false;
}

function isVisible(el: Element): boolean {
  const style = window.getComputedStyle(el);
  if (style.display === "none" || style.visibility === "hidden" || style.opacity === "0") return false;
  const rect = el.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) return false;
  return true;
}

function captureElements(): CapturedElement[] {
  const elements: CapturedElement[] = [];
  const allElements = document.querySelectorAll(
    "button, a, input, textarea, select, [role='button'], [tabindex], [onclick], h1, h2, h3, h4, p, span, div, img, label, li"
  );

  for (const el of allElements) {
    if (!isVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    // Skip elements outside viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    if (rect.right < 0 || rect.left > window.innerWidth) continue;
    // Skip very small elements
    if (rect.width < 4 && rect.height < 4) continue;

    const tag = el.tagName.toLowerCase();
    const interactive = isInteractive(el);

    // For non-interactive elements, only capture if they have visible text
    if (!interactive && !["h1", "h2", "h3", "h4", "img"].includes(tag)) {
      // Only capture divs/spans that are leaf text nodes or significant containers
      if (["div", "span", "p", "li", "label"].includes(tag)) {
        const text = el.textContent?.trim() || "";
        if (!text || text.length > 200) continue;
        // Skip if this element has interactive children (avoid duplication)
        if (el.querySelector("button, a, input, textarea, select, [role='button']")) continue;
      } else {
        continue;
      }
    }

    const captured: CapturedElement = {
      id: el.id || "",
      tag,
      selector: getUniqueSelector(el),
      text: (el.textContent?.trim() || "").slice(0, 100),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      interactive,
      classes: (typeof el.className === "string" ? el.className : "").slice(0, 200),
      disabled: (el as HTMLButtonElement).disabled || false,
    };

    if (tag === "input" || tag === "textarea") {
      const input = el as HTMLInputElement;
      captured.type = input.type;
      captured.value = input.type === "password" ? "••••" : input.value;
      captured.placeholder = input.placeholder;
      captured.checked = input.checked;
    }

    if (tag === "a") {
      captured.href = (el as HTMLAnchorElement).href;
    }

    if (tag === "select") {
      captured.value = (el as HTMLSelectElement).value;
    }

    elements.push(captured);
  }

  // Limit to 300 elements max for performance
  return elements.slice(0, 300);
}

export function captureDOMSnapshot(): DOMSnapshot {
  return {
    url: window.location.href,
    title: document.title,
    viewport: {
      width: window.innerWidth,
      height: window.innerHeight,
    },
    scroll: {
      x: window.scrollX,
      y: window.scrollY,
    },
    elements: captureElements(),
    activeElementSelector: document.activeElement
      ? getUniqueSelector(document.activeElement)
      : null,
    timestamp: Date.now(),
  };
}

// ── Action Executor ──

export function executeRemoteAction(action: RemoteAction): boolean {
  try {
    switch (action.type) {
      case "click": {
        if (action.selector) {
          const el = document.querySelector(action.selector);
          if (el) {
            (el as HTMLElement).click();
            return true;
          }
        }
        if (action.coords) {
          const el = document.elementFromPoint(action.coords.x, action.coords.y);
          if (el) {
            (el as HTMLElement).click();
            return true;
          }
        }
        return false;
      }

      case "input": {
        if (!action.selector || action.value === undefined) return false;
        const input = document.querySelector(action.selector) as HTMLInputElement | HTMLTextAreaElement | null;
        if (!input) return false;
        input.focus();
        // Use native input setter to trigger React's onChange
        const nativeSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, "value"
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, "value"
        )?.set;
        if (nativeSetter) {
          nativeSetter.call(input, action.value);
        } else {
          input.value = action.value;
        }
        input.dispatchEvent(new Event("input", { bubbles: true }));
        input.dispatchEvent(new Event("change", { bubbles: true }));
        return true;
      }

      case "scroll": {
        if (action.scrollDelta) {
          window.scrollBy(action.scrollDelta.x, action.scrollDelta.y);
          return true;
        }
        if (action.coords) {
          window.scrollTo(action.coords.x, action.coords.y);
          return true;
        }
        return false;
      }

      case "navigate": {
        if (action.value) {
          window.location.href = action.value;
          return true;
        }
        return false;
      }

      case "keyboard": {
        if (!action.key) return false;
        const activeEl = document.activeElement as HTMLElement;
        if (activeEl) {
          activeEl.dispatchEvent(new KeyboardEvent("keydown", {
            key: action.key,
            bubbles: true,
          }));
          activeEl.dispatchEvent(new KeyboardEvent("keyup", {
            key: action.key,
            bubbles: true,
          }));
        }
        return true;
      }

      default:
        return false;
    }
  } catch (err) {
    console.error("Remote action execution error:", err);
    return false;
  }
}

// ── Remote Capture Manager ──

export class RemoteCaptureManager {
  private socket: Socket;
  private sessionId: string;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private cursorTracker: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private eventTracker: ((e: Event) => void) | null = null;
  private isActive = false;

  constructor(socket: Socket, sessionId: string) {
    this.socket = socket;
    this.sessionId = sessionId;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // Send initial snapshot immediately
    this.sendSnapshot();

    // Send snapshots every 2 seconds (adaptive)
    this.snapshotInterval = setInterval(() => {
      this.sendSnapshot();
    }, 2000);

    // Track cursor/touch position (throttled to ~15fps)
    let lastCursorTime = 0;
    this.cursorTracker = (e: MouseEvent | TouchEvent) => {
      const now = Date.now();
      if (now - lastCursorTime < 66) return; // ~15fps
      lastCursorTime = now;

      let x: number, y: number;
      if ("touches" in e && e.touches.length > 0) {
        x = e.touches[0].clientX;
        y = e.touches[0].clientY;
      } else if ("clientX" in e) {
        x = e.clientX;
        y = e.clientY;
      } else {
        return;
      }

      this.socket.volatile.emit("remote-view:cursor", {
        sessionId: this.sessionId,
        x: Math.round(x),
        y: Math.round(y),
      });
    };
    document.addEventListener("mousemove", this.cursorTracker);
    document.addEventListener("touchmove", this.cursorTracker, { passive: true });

    // Track user interaction events
    this.eventTracker = (e: Event) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      this.socket.emit("remote-view:user-event", {
        sessionId: this.sessionId,
        event: {
          type: e.type as any,
          selector: getUniqueSelector(target),
          coords: (e as MouseEvent).clientX
            ? { x: (e as MouseEvent).clientX, y: (e as MouseEvent).clientY }
            : undefined,
          timestamp: Date.now(),
        },
      });

      // Send an immediate snapshot after click/input for responsiveness
      setTimeout(() => this.sendSnapshot(), 100);
    };
    document.addEventListener("click", this.eventTracker, { capture: true });
    document.addEventListener("input", this.eventTracker, { capture: true });

    // Listen for remote actions
    this.socket.on("remote-view:action", (data: { sessionId: string; action: RemoteAction; arlName: string }) => {
      if (data.sessionId !== this.sessionId) return;
      const success = executeRemoteAction(data.action);
      // Send updated snapshot after action
      setTimeout(() => this.sendSnapshot(), 200);
      console.log(`🖥️ Remote action ${data.action.type} by ${data.arlName}: ${success ? "✅" : "❌"}`);
    });

    // Listen for session end
    this.socket.on("remote-view:ended", (data: { sessionId: string }) => {
      if (data.sessionId !== this.sessionId) return;
      this.stop();
    });

    console.log(`🖥️ Remote capture started for session ${this.sessionId}`);
  }

  stop() {
    if (!this.isActive) return;
    this.isActive = false;

    if (this.snapshotInterval) {
      clearInterval(this.snapshotInterval);
      this.snapshotInterval = null;
    }

    if (this.cursorTracker) {
      document.removeEventListener("mousemove", this.cursorTracker);
      document.removeEventListener("touchmove", this.cursorTracker);
      this.cursorTracker = null;
    }

    if (this.eventTracker) {
      document.removeEventListener("click", this.eventTracker, { capture: true } as any);
      document.removeEventListener("input", this.eventTracker, { capture: true } as any);
      this.eventTracker = null;
    }

    this.socket.off("remote-view:action");
    this.socket.off("remote-view:ended");

    console.log(`🖥️ Remote capture stopped for session ${this.sessionId}`);
  }

  private sendSnapshot() {
    if (!this.isActive) return;
    try {
      const snapshot = captureDOMSnapshot();
      this.socket.emit("remote-view:snapshot", {
        sessionId: this.sessionId,
        snapshot,
      });
    } catch (err) {
      console.error("Remote snapshot error:", err);
    }
  }
}
