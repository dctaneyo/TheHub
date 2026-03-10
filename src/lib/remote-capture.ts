"use client";

import type { Socket } from "socket.io-client";
import type { CapturedElement, DOMSnapshot, RemoteAction } from "./socket-handlers/types";
// html2canvas imported dynamically to avoid SSR/bundling issues

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

function getDirectText(el: Element): string {
  let text = "";
  for (const node of el.childNodes) {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent || "";
    }
  }
  return text.trim();
}

function captureComputedStyles(el: Element) {
  const cs = window.getComputedStyle(el);
  return {
    bgColor: cs.backgroundColor,
    color: cs.color,
    fontSize: cs.fontSize,
    fontWeight: cs.fontWeight,
    borderRadius: cs.borderRadius,
    border: cs.border !== "none" ? cs.borderWidth + " " + cs.borderStyle + " " + cs.borderColor : "none",
    opacity: cs.opacity,
    overflow: cs.overflow,
    display: cs.display,
    textAlign: cs.textAlign,
    boxShadow: cs.boxShadow !== "none" ? cs.boxShadow : "none",
  };
}

function hasVisibleBg(bgColor: string): boolean {
  if (!bgColor || bgColor === "transparent" || bgColor === "rgba(0, 0, 0, 0)") return false;
  return true;
}

function captureElements(): CapturedElement[] {
  const elements: CapturedElement[] = [];
  const capturedRects = new Set<string>();

  // Walk the DOM tree in document order so we capture parent containers first
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_ELEMENT,
    {
      acceptNode(node) {
        const el = node as Element;
        const tag = el.tagName.toLowerCase();
        // Skip script, style, meta elements
        if (["script", "style", "noscript", "meta", "link", "br", "hr"].includes(tag)) {
          return NodeFilter.FILTER_REJECT;
        }
        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node: Element | null = walker.currentNode as Element;
  while (node) {
    const el = node;
    node = walker.nextNode() as Element | null;

    if (!isVisible(el)) continue;

    const rect = el.getBoundingClientRect();
    // Skip elements outside viewport
    if (rect.bottom < 0 || rect.top > window.innerHeight) continue;
    if (rect.right < 0 || rect.left > window.innerWidth) continue;
    // Skip very small elements
    if (rect.width < 2 && rect.height < 2) continue;

    const tag = el.tagName.toLowerCase();
    const interactive = isInteractive(el);
    const cs = window.getComputedStyle(el);
    const hasBg = hasVisibleBg(cs.backgroundColor);
    const hasBorder = cs.borderStyle !== "none" && cs.borderWidth !== "0px";
    const hasBoxShadow = cs.boxShadow !== "none";
    const directText = getDirectText(el);
    const isContainer = el.children.length > 0;

    // Decide whether this element is worth capturing:
    // 1. Always capture interactive elements
    // 2. Capture elements with visible background/border (visual containers)
    // 3. Capture headings and images
    // 4. Capture leaf text nodes (elements with direct text content and no child elements)
    // 5. Skip generic wrapper divs that have no visual significance
    const isLeafText = directText.length > 0 && !isContainer;
    const isVisualContainer = hasBg || hasBorder || hasBoxShadow;
    const isHeading = ["h1", "h2", "h3", "h4", "h5", "h6"].includes(tag);
    const isMedia = ["img", "video", "canvas", "svg"].includes(tag);

    if (!interactive && !isVisualContainer && !isHeading && !isMedia && !isLeafText) {
      // Skip invisible wrapper elements
      continue;
    }

    // Deduplicate elements at the exact same rect (common with nested wrappers)
    const rectKey = `${Math.round(rect.x)},${Math.round(rect.y)},${Math.round(rect.width)},${Math.round(rect.height)}`;
    if (capturedRects.has(rectKey) && !interactive) continue;
    capturedRects.add(rectKey);

    const captured: CapturedElement = {
      id: el.id || "",
      tag,
      selector: getUniqueSelector(el),
      text: (isLeafText ? directText : (el.textContent?.trim() || "")).slice(0, 100),
      rect: {
        x: Math.round(rect.x),
        y: Math.round(rect.y),
        width: Math.round(rect.width),
        height: Math.round(rect.height),
      },
      interactive,
      classes: (typeof el.className === "string" ? el.className : "").slice(0, 200),
      disabled: (el as HTMLButtonElement).disabled || false,
      styles: captureComputedStyles(el),
      children: el.children.length,
      zIndex: parseInt(cs.zIndex) || 0,
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

    // Cap at 500 elements for performance
    if (elements.length >= 500) break;
  }

  return elements;
}

async function captureScreenshot(): Promise<string | undefined> {
  try {
    const { toJpeg } = await import("html-to-image");

    const scale = window.devicePixelRatio > 1 ? 0.7 : 0.85;
    const dataUrl = await Promise.race([
      toJpeg(document.documentElement, {
        quality: 0.85,
        width: window.innerWidth,
        height: window.innerHeight,
        canvasWidth: Math.round(window.innerWidth * scale),
        canvasHeight: Math.round(window.innerHeight * scale),
        pixelRatio: 1,
        skipAutoScale: true,
        cacheBust: true,
        filter: (node: HTMLElement) => {
          // Skip the remote-view border overlay itself to avoid recursion
          if (node?.dataset?.remoteViewOverlay === "true") return false;
          return true;
        },
      }),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("screenshot timeout")), 5000)
      ),
    ]);

    return dataUrl;
  } catch (err) {
    console.warn("Screenshot capture failed:", err);
    return undefined;
  }
}

export async function captureDOMSnapshot(includeScreenshot = true): Promise<DOMSnapshot> {
  const screenshot = includeScreenshot ? await captureScreenshot() : undefined;

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
    screenshot,
  };
}

// ── Action Executor ──

export function executeRemoteAction(action: RemoteAction): boolean {
  try {
    switch (action.type) {
      case "click": {
        let target: Element | null = null;
        if (action.coords) {
          target = document.elementFromPoint(action.coords.x, action.coords.y);
        }
        if (!target && action.selector) {
          target = document.querySelector(action.selector);
        }
        if (target) {
          const htmlEl = target as HTMLElement;
          const cx = action.coords?.x ?? 0;
          const cy = action.coords?.y ?? 0;
          const opts: PointerEventInit & MouseEventInit = {
            bubbles: true, cancelable: true, composed: true,
            clientX: cx, clientY: cy, pointerId: 1, pointerType: "mouse",
            button: 0, buttons: 1,
          };
          htmlEl.dispatchEvent(new PointerEvent("pointerdown", opts));
          htmlEl.dispatchEvent(new MouseEvent("mousedown", opts));
          htmlEl.dispatchEvent(new PointerEvent("pointerup", { ...opts, buttons: 0 }));
          htmlEl.dispatchEvent(new MouseEvent("mouseup", { ...opts, buttons: 0 }));
          htmlEl.dispatchEvent(new MouseEvent("click", { ...opts, buttons: 0 }));
          return true;
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
  private mirrorMode: boolean;
  private snapshotInterval: ReturnType<typeof setInterval> | null = null;
  private cursorTracker: ((e: MouseEvent | TouchEvent) => void) | null = null;
  private eventTracker: ((e: Event) => void) | null = null;
  private scrollTracker: (() => void) | null = null;
  private actionHandler: ((data: any) => void) | null = null;
  private endedHandler: ((data: any) => void) | null = null;
  private deviceInfoRequestHandler: ((data: any) => void) | null = null;
  private isActive = false;
  private isCapturing = false; // Prevent overlapping captures

  /**
   * @param mirrorMode - When true, skips screenshot/DOM capture and only streams
   *   cursor, clicks, scroll, and device info. The ARL loads the actual app natively.
   */
  constructor(socket: Socket, sessionId: string, mirrorMode = false) {
    this.socket = socket;
    this.sessionId = sessionId;
    this.mirrorMode = mirrorMode;
  }

  start() {
    if (this.isActive) return;
    this.isActive = true;

    // In mirror mode, send device info immediately so ARL knows the viewport
    if (this.mirrorMode) {
      this.sendDeviceInfo();
    } else {
      // Legacy mode: send initial screenshot snapshot immediately
      this.sendSnapshot(true);

      // Send full screenshot snapshots every 3 seconds
      this.snapshotInterval = setInterval(() => {
        this.sendSnapshot(true);
      }, 3000);
    }

    // Track cursor/touch position (throttled to ~30fps)
    let lastCursorTime = 0;
    this.cursorTracker = (e: MouseEvent | TouchEvent) => {
      const now = Date.now();
      if (now - lastCursorTime < 33) return; // ~30fps
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

      // In mirror mode, send click coordinates for ripple visualization
      if (this.mirrorMode && e.type === "click") {
        const me = e as MouseEvent;
        this.socket.emit("mirror:click", {
          sessionId: this.sessionId,
          x: Math.round(me.clientX),
          y: Math.round(me.clientY),
        });
        return;
      }

      // Legacy mode: send full user event data
      if (!this.mirrorMode) {
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

        // Send a screenshot snapshot shortly after interaction for responsiveness
        setTimeout(() => this.sendSnapshot(true), 300);
      }
    };
    document.addEventListener("click", this.eventTracker, { capture: true });
    if (!this.mirrorMode) {
      document.addEventListener("input", this.eventTracker, { capture: true });
    }

    // Mirror mode: track scroll position
    if (this.mirrorMode) {
      let lastScrollTime = 0;
      this.scrollTracker = () => {
        const now = Date.now();
        if (now - lastScrollTime < 100) return; // throttle to ~10fps
        lastScrollTime = now;
        this.socket.volatile.emit("mirror:scroll", {
          sessionId: this.sessionId,
          x: Math.round(window.scrollX),
          y: Math.round(window.scrollY),
        });
      };
      window.addEventListener("scroll", this.scrollTracker, { passive: true });
    }

    // Listen for remote actions (store reference for clean removal)
    this.actionHandler = (data: { sessionId: string; action: RemoteAction; arlName: string }) => {
      if (data.sessionId !== this.sessionId) return;
      const success = executeRemoteAction(data.action);
      // In legacy mode, send updated screenshot after action
      if (!this.mirrorMode) {
        setTimeout(() => this.sendSnapshot(true), 400);
      }
      console.log(`🖥️ Remote action ${data.action.type} by ${data.arlName}: ${success ? "✅" : "❌"}`);
    };
    this.socket.on("remote-view:action", this.actionHandler);

    // Listen for session end (store reference for clean removal)
    this.endedHandler = (data: { sessionId: string }) => {
      if (data.sessionId !== this.sessionId) return;
      this.stop();
    };
    this.socket.on("remote-view:ended", this.endedHandler);

    // Mirror mode: listen for device info re-request (when new mirror tab joins)
    if (this.mirrorMode) {
      this.deviceInfoRequestHandler = (data: { sessionId: string }) => {
        if (data.sessionId !== this.sessionId) return;
        this.sendDeviceInfo();
      };
      this.socket.on("mirror:request-device-info", this.deviceInfoRequestHandler);
    }

    console.log(`🖥️ Remote capture started for session ${this.sessionId} (mirror: ${this.mirrorMode})`);
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

    if (this.scrollTracker) {
      window.removeEventListener("scroll", this.scrollTracker);
      this.scrollTracker = null;
    }

    if (this.actionHandler) {
      this.socket.off("remote-view:action", this.actionHandler);
      this.actionHandler = null;
    }
    if (this.endedHandler) {
      this.socket.off("remote-view:ended", this.endedHandler);
      this.endedHandler = null;
    }
    if (this.deviceInfoRequestHandler) {
      this.socket.off("mirror:request-device-info", this.deviceInfoRequestHandler);
      this.deviceInfoRequestHandler = null;
    }

    console.log(`🖥️ Remote capture stopped for session ${this.sessionId}`);
  }

  private sendDeviceInfo() {
    const layout = typeof localStorage !== "undefined" ? localStorage.getItem("hub-dashboard-layout") || "classic" : "classic";
    this.socket.emit("mirror:device-info", {
      sessionId: this.sessionId,
      device: {
        width: window.innerWidth,
        height: window.innerHeight,
        isMobile: /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || window.innerWidth < 768,
        userAgent: navigator.userAgent,
        layout,
      },
    });
  }

  /** Broadcast current view state to mirror dashboard (call from React when views change) */
  broadcastViewState(viewState: { chatOpen?: boolean; formsOpen?: boolean; calendarOpen?: boolean; layout?: string; mobileView?: string; accordions?: { completed?: boolean; missed?: boolean; leaderboard?: boolean }; notificationsOpen?: boolean; settingsOpen?: boolean }) {
    if (!this.isActive || !this.mirrorMode) return;
    this.socket.emit("mirror:view-change", {
      sessionId: this.sessionId,
      viewState,
    });
  }

  getSessionId() {
    return this.sessionId;
  }

  private async sendSnapshot(includeScreenshot = true) {
    if (!this.isActive || this.isCapturing || this.mirrorMode) return;
    this.isCapturing = true;
    try {
      const snapshot = await captureDOMSnapshot(includeScreenshot);
      if (this.isActive) {
        this.socket.emit("remote-view:snapshot", {
          sessionId: this.sessionId,
          snapshot,
        });
      }
    } catch (err) {
      console.error("Remote snapshot error:", err);
    } finally {
      this.isCapturing = false;
    }
  }
}
