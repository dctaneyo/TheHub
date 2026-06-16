"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";
import { setReloadBlocked } from "@/lib/reload-guard";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2, AlertCircle, Wifi, WifiOff, ChevronLeft, Store, Users, Monitor, RefreshCw, Keyboard, Lock, CheckCircle2, Sun, Moon } from "@/lib/icons";
import { useTheme } from "next-themes";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { useAuth } from "@/lib/auth-context";

type LoginStep = "userId" | "pin";

const HUB_DOMAINS = ["meetthehub.com", "meethehub.com"];

/**
 * Extract a per-org slug from the current subdomain (kazi.meetthehub.com → "kazi").
 * Returns null on the bare domain, www, and the reserved join/admin subdomains.
 */
function getSubdomainOrgSlug(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  for (const d of HUB_DOMAINS) {
    if (host === d || host === `www.${d}`) return null;
    if (host.endsWith(`.${d}`)) {
      const sub = host.slice(0, host.length - d.length - 1);
      if (!sub || sub === "www" || sub === "join" || sub === "admin") return null;
      if (!/^[a-zA-Z0-9]{2,10}$/.test(sub)) return null;
      return sub.toLowerCase();
    }
  }
  return null;
}

interface ValidatedUser {
  userType: "location" | "arl";
  name: string;
  storeNumber?: string;
  role?: string;
}

interface ResolvedTenant {
  id: string;
  slug: string;
  name: string;
  logoUrl: string | null;
  primaryColor: string;
  accentColor: string | null;
  faviconUrl: string | null;
  appTitle: string | null;
}

/**
 * Animated mesh-gradient background — four large blurred blobs in the Hub's
 * brand palette (red/orange/yellow + neutral) that slowly drift in sinusoidal
 * paths. Pure CSS transforms via Framer Motion; no canvas, no particle counts.
 * Isolated component so it never re-renders with the rest of the login page.
 */
function MeshGradient() {
  const blobs = [
    // [x%, y%, w, h, color, xAmp, yAmp, duration, delay]
    { id: 0, x: 15,  y: 20,  w: 600, h: 600, color: "rgba(220,38,38,0.13)",   xA: 60,  yA: 80,  dur: 22, delay: 0   },
    { id: 1, x: 70,  y: 10,  w: 500, h: 500, color: "rgba(249,115,22,0.11)",  xA: -80, yA: 60,  dur: 28, delay: 5   },
    { id: 2, x: 55,  y: 65,  w: 650, h: 650, color: "rgba(234,179,8,0.09)",   xA: 70,  yA: -70, dur: 25, delay: 10  },
    { id: 3, x: 5,   y: 60,  w: 450, h: 450, color: "rgba(148,163,184,0.07)", xA: -50, yA: -60, dur: 32, delay: 3   },
  ];

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {blobs.map((b) => (
        <motion.div
          key={b.id}
          style={{
            position: "absolute",
            left: `${b.x}%`,
            top:  `${b.y}%`,
            width:  b.w,
            height: b.h,
            borderRadius: "50%",
            background: `radial-gradient(circle at center, ${b.color} 0%, transparent 70%)`,
            filter: "blur(60px)",
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            x: [0, b.xA, 0, -b.xA * 0.6, 0],
            y: [0, b.yA * 0.5, b.yA, b.yA * 0.3, 0],
          }}
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: b.delay,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Dot-pulse grid background — a grid of small dots whose opacity/scale pulses
 * outward from the centre in a radial ripple wave, like a sonar ping. The dots
 * are fixed; only colour changes animate.
 */
function DotPulseGrid() {
  const COLS = 22;
  const ROWS = 14;
  const cx = COLS / 2 - 0.5;
  const cy = ROWS / 2 - 0.5;
  const maxDist = Math.sqrt(cx * cx + cy * cy);

  // Build dot definitions once — deterministic, no randomness
  const dots = [];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const dist = Math.sqrt((c - cx) ** 2 + (r - cy) ** 2);
      // Stagger delay based on distance from center so the ripple radiates out
      const delay = (dist / maxDist) * 2.4;
      dots.push({ id: `${r}-${c}`, x: (c / (COLS - 1)) * 100, y: (r / (ROWS - 1)) * 100, delay });
    }
  }

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden>
      {dots.map((d) => (
        <motion.div
          key={d.id}
          style={{
            position: "absolute",
            left:  `${d.x}%`,
            top:   `${d.y}%`,
            width:  4,
            height: 4,
            borderRadius: "50%",
            backgroundColor: "var(--hub-red)",
            transform: "translate(-50%, -50%)",
          }}
          animate={{
            opacity: [0.07, 0.32, 0.07],
            scale:   [0.8,  1.6,  0.8],
          }}
          transition={{
            duration: 3.2,
            repeat: Infinity,
            ease: "easeInOut",
            delay: d.delay,
            repeatDelay: 1.2,
          }}
        />
      ))}
    </div>
  );
}

/**
 * Concentric rings background — a set of rings centred on the screen that
 * continuously expand and fade outward, like a sonar ping / WiFi signal.
 */
function ConcentricRings() {
  const rings = [0, 1, 2, 3, 4];

  return (
    <div className="pointer-events-none fixed inset-0 overflow-hidden flex items-center justify-center" aria-hidden>
      {rings.map((i) => (
        <motion.div
          key={i}
          style={{
            position: "absolute",
            borderRadius: "50%",
            border: "1.5px solid var(--hub-red)",
          }}
          initial={{ width: 80, height: 80, opacity: 0 }}
          animate={{
            width:   [80, 900],
            height:  [80, 900],
            opacity: [0.28, 0],
          }}
          transition={{
            duration: 4.5,
            repeat: Infinity,
            ease: "easeOut",
            delay: i * 0.9,
          }}
        />
      ))}
    </div>
  );
}

// ── Background picker ──────────────────────────────────────────────────────

type LoginBg = "mesh" | "dots" | "rings" | "none";

const BG_OPTIONS: { value: LoginBg; label: string }[] = [
  { value: "mesh",  label: "Mesh"  },
  { value: "dots",  label: "Dots"  },
  { value: "rings", label: "Rings" },
  { value: "none",  label: "None"  },
];

const BG_STORAGE_KEY = "hub-login-bg";

function useBgPreference(): [LoginBg, (v: LoginBg) => void] {
  const [bg, setBgState] = useState<LoginBg>("mesh");

  useEffect(() => {
    const stored = localStorage.getItem(BG_STORAGE_KEY) as LoginBg | null;
    if (stored && BG_OPTIONS.some((o) => o.value === stored)) setBgState(stored);
  }, []);

  const setBg = useCallback((v: LoginBg) => {
    setBgState(v);
    localStorage.setItem(BG_STORAGE_KEY, v);
  }, []);

  return [bg, setBg];
}

function ActiveBackground({ bg }: { bg: LoginBg }) {
  if (bg === "mesh")  return <MeshGradient />;
  if (bg === "dots")  return <DotPulseGrid />;
  if (bg === "rings") return <ConcentricRings />;
  return null;
}

function BgPicker({ bg, setBg }: { bg: LoginBg; setBg: (v: LoginBg) => void }) {
  const [open, setOpen] = useState(false);
  const current = BG_OPTIONS.find((o) => o.value === bg)!;

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        title="Change background"
        className="flex h-9 items-center gap-2 rounded-full bg-card/80 px-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-card select-none"
      >
        {/* Small animated preview dot */}
        <motion.span
          className="h-2 w-2 rounded-full bg-[var(--hub-red)]"
          animate={bg !== "none" ? { opacity: [0.4, 1, 0.4], scale: [0.8, 1.2, 0.8] } : { opacity: 0.3, scale: 1 }}
          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
        />
        <span className="text-[10px] font-medium text-muted-foreground">{current.label}</span>
      </button>

      <AnimatePresence>
        {open && (
          <>
            {/* Click-outside dismiss */}
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.96 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-1.5 flex flex-col gap-0.5 rounded-2xl border border-border bg-card/95 p-1.5 shadow-lg backdrop-blur-md min-w-[110px]"
            >
              {BG_OPTIONS.map((o) => (
                <button
                  key={o.value}
                  onClick={() => { setBg(o.value); setOpen(false); }}
                  className={`flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left text-xs font-medium transition-colors ${
                    o.value === bg
                      ? "bg-[var(--hub-red)]/10 text-[var(--hub-red)]"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {o.value === bg && <span className="h-1.5 w-1.5 rounded-full bg-[var(--hub-red)]" />}
                  {o.value !== bg && <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/30" />}
                  {o.label}
                </button>
              ))}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function LoginPage() {
  const { login } = useAuth();
  const { theme, setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  useEffect(() => setThemeMounted(true), []);
  const cycleTheme = useCallback(() => {
    if (theme === "light") setTheme("dark");
    else if (theme === "dark") setTheme("system");
    else setTheme("light");
  }, [theme, setTheme]);

  const [bg, setBg] = useBgPreference();

  const [step, setStep] = useState<LoginStep>("userId");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedUser, setValidatedUser] = useState<ValidatedUser | null>(null);
  const [isOnline] = useState(true);

  // Org entry state
  const [orgSlug, setOrgSlug] = useState<string | null>(null);
  const [orgInput, setOrgInput] = useState("");
  const [orgError, setOrgError] = useState("");
  const [orgLoading, setOrgLoading] = useState(false);
  const [resolvedTenant, setResolvedTenant] = useState<ResolvedTenant | null>(null);
  const [showOrgKeyboard, setShowOrgKeyboard] = useState(false);
  const [orgChecked, setOrgChecked] = useState(false);
  // True when the org is fixed by the subdomain — hides the "change org" control.
  const [lockedToSubdomain, setLockedToSubdomain] = useState(false);

  // Block build-update auto-reload while the user is actively entering a user
  // ID or PIN — losing a partially-typed code would be confusing. The org entry
  // screen (orgSlug === null) is idle enough to allow a reload safely.
  // The block is always cleared on unmount (navigation / successful login).
  useEffect(() => {
    const isActiveStep = orgSlug !== null; // org resolved → user ID or PIN step
    setReloadBlocked(isActiveStep);
    return () => setReloadBlocked(false);
  }, [orgSlug]);

  const userIdRef = useRef("");
  const pinRef = useRef("");
  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const orgInputRef = useRef<HTMLInputElement>(null);

  // ---- Staff lockout bypass ------------------------------------------------
  // Triggered by 5 rapid taps on the logo within 2 seconds.
  const [showBypass, setShowBypass] = useState(false);
  const [bypassCode, setBypassCode] = useState("");
  const [bypassError, setBypassError] = useState("");
  const [bypassLoading, setBypassLoading] = useState(false);
  const [bypassDone, setBypassDone] = useState(false);
  const logoTapCount = useRef(0);
  const logoTapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bypassIdleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const resetBypassIdleTimer = useCallback(() => {
    if (bypassIdleTimer.current) clearTimeout(bypassIdleTimer.current);
    bypassIdleTimer.current = setTimeout(() => setShowBypass(false), 30_000);
  }, []);

  const openBypassDialog = useCallback(() => {
    setShowBypass(true);
    setBypassCode("");
    setBypassError("");
    setBypassDone(false);
    resetBypassIdleTimer();
  }, [resetBypassIdleTimer]);

  const closeBypassDialog = useCallback(() => {
    setShowBypass(false);
    setBypassCode("");
    setBypassError("");
    if (bypassIdleTimer.current) clearTimeout(bypassIdleTimer.current);
  }, []);

  // Secret trigger: 5 taps within 2 s on the connection status indicator.
  const handleConnectionTap = useCallback(() => {
    logoTapCount.current += 1;
    if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
    logoTapTimer.current = setTimeout(() => { logoTapCount.current = 0; }, 2000);
    if (logoTapCount.current >= 5) {
      logoTapCount.current = 0;
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      openBypassDialog();
    }
  }, [openBypassDialog]);

  // Bypass numpad handlers.
  const handleBypassDigit = useCallback((digit: string) => {
    if (bypassLoading || bypassDone) return;
    setBypassCode(prev => prev.length < 4 ? prev + digit : prev);
    resetBypassIdleTimer();
  }, [bypassLoading, bypassDone, resetBypassIdleTimer]);

  const handleBypassDelete = useCallback(() => {
    setBypassCode(prev => prev.slice(0, -1));
    resetBypassIdleTimer();
  }, [resetBypassIdleTimer]);

  const handleBypassSubmit = useCallback(async () => {
    if (bypassCode.length !== 4 || bypassLoading || bypassDone) return;
    setBypassLoading(true);
    setBypassError("");
    try {
      const res = await fetch("/api/auth/reset-lockout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: bypassCode }),
      });
      if (res.ok) {
        setBypassDone(true);
        setBypassLoading(false);
        setTimeout(() => {
          closeBypassDialog();
          setBypassDone(false);
          setError(""); // clear the "Too many attempts" error on the main screen
        }, 1800);
      } else if (res.status === 429) {
        const retryAfterSec = parseInt(res.headers.get("Retry-After") || "3600", 10);
        const retryMin = Math.ceil(retryAfterSec / 60);
        setBypassError(`Too many attempts. Try again in ${retryMin} min.`);
        setBypassCode("");
        setBypassLoading(false);
      } else {
        setBypassError("Invalid bypass code.");
        setBypassCode("");
        setBypassLoading(false);
      }
    } catch {
      setBypassError("Connection error. Try again.");
      setBypassLoading(false);
    }
  }, [bypassCode, bypassLoading, bypassDone, closeBypassDialog]);

  // Auto-submit when all 4 bypass digits are entered.
  useEffect(() => {
    if (bypassCode.length === 4 && !bypassLoading && !bypassDone) {
      handleBypassSubmit();
    }
  }, [bypassCode, bypassLoading, bypassDone, handleBypassSubmit]);

  // Cleanup timers on unmount.
  useEffect(() => {
    return () => {
      if (logoTapTimer.current) clearTimeout(logoTapTimer.current);
      if (bypassIdleTimer.current) clearTimeout(bypassIdleTimer.current);
    };
  }, []);

  // Apply tenant branding to the page (CSS variables, title, favicon)
  const applyBranding = useCallback((tenant: ResolvedTenant) => {
    const root = document.documentElement;
    const color = tenant.primaryColor || "#dc2626";
    root.style.setProperty("--hub-red", color);
    root.style.setProperty("--primary", color);
    root.style.setProperty("--ring", color);
    if (tenant.appTitle) {
      document.title = tenant.appTitle;
    }
    if (tenant.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = tenant.faviconUrl;
    }
  }, []);

  // Check IP association first, then localStorage for persisted org on mount
  useEffect(() => {
    let cancelled = false;

    (async () => {
      // Step 0: per-org subdomain (kazi.meetthehub.com) — highest priority.
      const subSlug = getSubdomainOrgSlug();
      if (subSlug) {
        try {
          const res = await fetch("/api/auth/resolve-org", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ slug: subSlug }),
          });
          if (cancelled) return;
          if (res.ok) {
            const data = await res.json();
            const tenant = data.tenant as ResolvedTenant;
            setOrgSlug(tenant.slug);
            setResolvedTenant(tenant);
            applyBranding(tenant);
            setLockedToSubdomain(true);
            localStorage.setItem("hub-org-id", tenant.slug);
            document.cookie = `x-org-id=${tenant.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
            setOrgChecked(true);
            return;
          }
          // Subdomain slug didn't resolve — fall through to IP/localStorage.
        } catch {
          // Network error — fall through.
        }
        if (cancelled) return;
      }

      // Step 1: Check IP-based org association (takes priority per Req 6.3)
      try {
        const ipRes = await fetch("/api/auth/resolve-org-by-ip");
        if (!cancelled && ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.ok && ipData.tenant) {
            const tenant = ipData.tenant as ResolvedTenant;
            setOrgSlug(tenant.slug);
            setResolvedTenant(tenant);
            applyBranding(tenant);
            // Persist IP-resolved org to cookie + localStorage for consistency
            localStorage.setItem("hub-org-id", tenant.slug);
            document.cookie = `x-org-id=${tenant.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
            setOrgChecked(true);
            return;
          }
        }
      } catch {
        // IP check failed — fall through to localStorage
      }

      if (cancelled) return;

      // Step 2: Fall through to localStorage check
      const storedSlug = localStorage.getItem("hub-org-id");
      if (!storedSlug) {
        setOrgChecked(true);
        return;
      }

      try {
        const res = await fetch("/api/auth/resolve-org", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ slug: storedSlug }),
        });

        if (cancelled) return;

        if (res.ok) {
          const data = await res.json();
          const tenant = data.tenant as ResolvedTenant;
          setOrgSlug(tenant.slug);
          setResolvedTenant(tenant);
          applyBranding(tenant);
        } else {
          // Stored slug is no longer valid — clear it
          localStorage.removeItem("hub-org-id");
          document.cookie = "x-org-id=; path=/; max-age=0";
        }
      } catch {
        // Network error — clear stored value and show org entry
        localStorage.removeItem("hub-org-id");
        document.cookie = "x-org-id=; path=/; max-age=0";
      } finally {
        if (!cancelled) {
          setOrgChecked(true);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [applyBranding]);

  // Submit org ID: validate, resolve tenant, persist, and apply branding
  const handleOrgSubmit = useCallback(async () => {
    const trimmed = orgInput.trim();
    if (trimmed.length < 2) {
      setOrgError("Organization ID must be at least 2 characters");
      return;
    }

    setOrgError("");
    setOrgLoading(true);

    try {
      const res = await fetch("/api/auth/resolve-org", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: trimmed }),
      });

      if (res.ok) {
        const data = await res.json();
        const tenant = data.tenant as ResolvedTenant;
        setOrgSlug(tenant.slug);
        setResolvedTenant(tenant);
        localStorage.setItem("hub-org-id", tenant.slug);
        document.cookie = `x-org-id=${tenant.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
        applyBranding(tenant);
      } else if (res.status === 404) {
        setOrgError("Organization not found");
      } else if (res.status === 429) {
        setOrgError("Too many attempts. Please try again later.");
      } else {
        setOrgError("Something went wrong. Please try again.");
      }
    } catch {
      setOrgError("Connection error. Please try again.");
    } finally {
      setOrgLoading(false);
    }
  }, [orgInput, applyBranding]);

  // Pending session for remote login
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [pendingCode, setPendingCode] = useState<string | null>(null);
  const [remoteActivating, setRemoteActivating] = useState(false);
  const [pinged, setPinged] = useState(false);

  // Track the latest pendingId in a ref so generateSession can cancel the
  // previous pending session without depending on pendingId (which would
  // recreate the callback and re-trigger the mount effect in a loop).
  const pendingIdRef = useRef<string | null>(null);
  useEffect(() => {
    pendingIdRef.current = pendingId;
  }, [pendingId]);

  const [refreshing, setRefreshing] = useState(false);
  const [shakeKey, setShakeKey] = useState(0);
  const [selfPinged, setSelfPinged] = useState(false);

  const handleSelfPing = () => {
    if (!socket || !pendingId || !pendingCode) return;
    socket.emit("session:self-ping", { pendingId, code: pendingCode });
    setSelfPinged(true);
    setTimeout(() => setSelfPinged(false), 2500);
  };

  const generateSession = useCallback(async () => {
    setRefreshing(true);
    try {
      // Cancel the old pending session so it disappears from ARL Hub
      const prevId = pendingIdRef.current;
      if (prevId) {
        fetch("/api/session/pending", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: prevId }),
        }).catch(() => {});
      }
      const r = await fetch("/api/session/pending", { method: "POST" });
      if (r.ok) {
        const data = await r.json();
        setPendingId(data.id);
        setPendingCode(data.code);
      }
    } catch {}
    setRefreshing(false);
  }, []);

  // Generate pending session on mount
  useEffect(() => {
    generateSession();
  }, [generateSession]);

  // Instant remote activation via WebSocket
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !pendingId) return;
    const handleActivated = async (data: { pendingId: string }) => {
      if (data.pendingId === pendingId) {
        // Fetch the redirect info
        try {
          const res = await fetch(`/api/session/pending/status?id=${pendingId}`);
          if (res.ok) {
            const d = await res.json();
            if (d.status === "activated" && d.redirectTo) {
              setRemoteActivating(true);
              window.location.href = d.redirectTo;
            }
          }
        } catch {}
      }
    };
    const handlePing = (data: { pendingId: string }) => {
      if (data.pendingId === pendingId) {
        setPinged(true);
        setTimeout(() => setPinged(false), 3000);
      }
    };
    socket.on("session:activated", handleActivated);
    socket.on("session:ping", handlePing);
    return () => {
      socket.off("session:activated", handleActivated);
      socket.off("session:ping", handlePing);
    };
  }, [socket, pendingId]);

  const currentValue = step === "userId" ? userId : pin;
  const maxLength = 4;

  // Keyboard support (hidden feature)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only handle if keyboard input is focused
      if (document.activeElement !== keyboardInputRef.current) return;
      
      const key = e.key;
      
      // Handle digits
      if (key >= '0' && key <= '9') {
        e.preventDefault();
        handleDigit(key);
      }
      // Handle backspace
      else if (key === 'Backspace') {
        e.preventDefault();
        handleDelete();
      }
      // Handle Enter
      else if (key === 'Enter') {
        e.preventDefault();
        if (step === 'pin' && pin.length === maxLength) {
          // Trigger login by calling the same logic as the login button
          const loginButton = document.querySelector('[data-login-button]') as HTMLButtonElement;
          if (loginButton) loginButton.click();
        }
      }
      // Handle Escape to go back
      else if (key === 'Escape' && step === 'pin') {
        e.preventDefault();
        goBackToUserId();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [step, userId, pin, maxLength]);

  const goBackToUserId = () => {
    setStep("userId");
    setValidatedUser(null);
    pinRef.current = "";
    setPin("");
    setError("");
  };

  const handleDigit = async (digit: string) => {
    setError("");
    if (step === "userId") {
      if (userIdRef.current.length < maxLength) {
        const newVal = userIdRef.current + digit;
        userIdRef.current = newVal;
        setUserId(newVal);
        if (newVal.length === maxLength) {
          // Validate user ID before advancing
          setValidating(true);
          try {
            const res = await fetch("/api/auth/validate-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: newVal }),
            });
            const data = await res.json();
            if (res.ok && data.found) {
              setValidatedUser(data);
              setError("");
              setStep("pin");
            } else {
              setError(data.error?.message || data.error || "User ID not found");
              // Reset so they can try again
              userIdRef.current = "";
              setUserId("");
            }
          } catch {
            setError("Connection error. Please try again.");
            userIdRef.current = "";
            setUserId("");
          }
          setValidating(false);
        }
      }
    } else {
      if (pinRef.current.length < maxLength) {
        const newVal = pinRef.current + digit;
        pinRef.current = newVal;
        setPin(newVal);
        if (newVal.length === maxLength) {
          handleLogin(userIdRef.current, newVal);
        }
      }
    }
  };

  const handleDelete = () => {
    setError("");
    if (step === "userId") {
      userIdRef.current = userIdRef.current.slice(0, -1);
      setUserId(userIdRef.current);
    } else {
      pinRef.current = pinRef.current.slice(0, -1);
      setPin(pinRef.current);
    }
  };

  const handleClearOrBack = () => {
    setError("");
    if (step === "userId") {
      userIdRef.current = "";
      setUserId("");
    } else {
      // On PIN screen: Clear button becomes Back
      goBackToUserId();
    }
  };

  const handleLogin = async (uid: string, p: string) => {
    setLoading(true);
    setError("");

    const result = await login(uid, p, orgSlug || undefined);

    if (result.success) {
      if (result.userType === "location") {
        window.location.href = "/dashboard";
      } else {
        window.location.href = "/arl";
      }
    } else {
      setError(result.error || "Incorrect PIN. Please try again.");
      setShakeKey((k) => k + 1);
      pinRef.current = "";
      setPin("");
      setLoading(false);
    }
  };

  const dots = Array.from({ length: maxLength }, (_, i) => {
    const filled = i < currentValue.length;
    return (
      <div key={i} className="relative flex items-center justify-center">
        {/* Ripple ring when dot fills */}
        {filled && (
          <motion.div
            key={`ripple-${i}-${currentValue.length}`}
            className="absolute rounded-full border-2 border-[var(--hub-red)]"
            initial={{ width: 20, height: 20, opacity: 0.7 }}
            animate={{ width: 36, height: 36, opacity: 0 }}
            transition={{ duration: 0.5, ease: "easeOut" }}
          />
        )}
        <motion.div
          className={`h-5 w-5 rounded-full border-2 transition-colors duration-200 ${
            filled
              ? "border-[var(--hub-red)] bg-[var(--hub-red)]"
              : "border-border bg-background"
          }`}
          animate={filled ? { scale: [1, 1.3, 1] } : {}}
          transition={{ duration: 0.15 }}
        />
      </div>
    );
  });

  const padButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "action", "0", "delete"];

  // Loading state — waiting for localStorage check
  if (!orgChecked) {
    return (
      <div className="min-h-screen min-h-dvh w-screen bg-background flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--hub-red)]" />
      </div>
    );
  }

  // Org Entry Screen — no org slug resolved yet
  if (orgChecked && !orgSlug) {
    return (
      <div className={`min-h-screen min-h-dvh w-screen overflow-y-auto bg-background flex flex-col items-center py-6 px-4 justify-center relative ${showOrgKeyboard ? "max-sm:justify-start max-sm:pt-12" : ""}`}>
        {themeMounted && (
          <div className="absolute right-4 top-4 z-50 flex items-center gap-2">
            <BgPicker bg={bg} setBg={setBg} />
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme}`}
              className="flex h-9 items-center gap-2 rounded-full bg-card/80 px-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-card select-none"
            >
              {theme === "dark"
                ? <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                : theme === "light"
                ? <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                : <Monitor className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-[10px] font-medium capitalize text-muted-foreground">{theme}</span>
            </button>
          </div>
        )}
        {/* Active background */}
        <ActiveBackground bg={bg} />

        {/* Spacer to push content above keyboard on mobile */}
        {showOrgKeyboard && <div className="flex-1 min-h-4 sm:hidden" />}
        {/* Hub icon — outside the card */}
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.3, ease: "easeOut" }}
          className="mb-4 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] shadow-lg shadow-red-200"
        >
          <span className="text-2xl sm:text-3xl font-black text-white">H</span>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="w-full max-w-sm rounded-3xl bg-card/90 backdrop-blur-md shadow-2xl shadow-red-100/30 border border-border px-5 py-4 sm:px-6 sm:py-5 flex flex-col items-center"
        >
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Welcome to The Hub</h1>

          <div className="mt-3 sm:mt-4 w-full">

            {/* Org input */}
            <div className="flex items-center justify-center gap-2 px-2 sm:px-4">
              <input
                ref={orgInputRef}
                type="text"
                value={orgInput}
                readOnly={showOrgKeyboard}
                maxLength={10}
                placeholder="Organization ID"
                onChange={(e) => {
                  const val = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
                  setOrgInput(val);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleOrgSubmit();
                  }
                }}
                style={{ textTransform: "uppercase" }}
                className="w-full max-w-[240px] rounded-xl border border-border bg-background px-4 py-3 text-center text-lg font-bold tracking-widest text-foreground outline-none focus:border-[var(--hub-red)] focus:ring-2 focus:ring-[var(--hub-red)]/20 transition-colors placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
              />
              <button
                onClick={() => setShowOrgKeyboard((v) => !v)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                  showOrgKeyboard
                    ? "bg-[var(--hub-red)] text-white shadow-md"
                    : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"
                }`}
                title={showOrgKeyboard ? "Hide virtual keyboard" : "Show virtual keyboard"}
              >
                <Keyboard className="h-5 w-5" />
              </button>
            </div>

            {/* Error message */}
            <AnimatePresence mode="wait">
              {orgError && (
                <motion.div
                  key="org-err"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="mt-3 flex w-full items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{orgError}</span>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Loading spinner during validation */}
            {orgLoading && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="mt-2 flex items-center justify-center gap-2 text-xs text-muted-foreground"
              >
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Validating organization...
              </motion.div>
            )}
          </div>
        </motion.div>

        {/* Virtual keyboard */}
        {showOrgKeyboard && (
          <>
            <OnscreenKeyboard
              value={orgInput}
              onChange={(val) => {
                const filtered = val.replace(/[^a-zA-Z0-9]/g, "").slice(0, 10).toUpperCase();
                setOrgInput(filtered);
              }}
              onSubmit={handleOrgSubmit}
              onDismiss={() => setShowOrgKeyboard(false)}
              placeholder="Organization ID"
            />
            {/* Reserve space so content isn't hidden behind the fixed keyboard */}
            <div className="h-[320px] sm:h-0 shrink-0" />
          </>
        )}
      </div>
    );
  }

  return (
    <div className="min-h-screen min-h-dvh w-screen overflow-y-auto bg-background flex flex-col items-center py-6 px-4">
      {/* Active background */}
      <ActiveBackground bg={bg} />
      {/* Hidden input for keyboard support */}
      <input
        ref={keyboardInputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        autoComplete="off"
        className="sr-only"
        aria-hidden="true"
        tabIndex={0}
        style={{ position: 'absolute', left: -9999 }}
      />

      {/* Top bar: session ID + connection + theme — hidden on mobile (shown inside card instead) */}
      <div className="absolute right-4 top-4 hidden sm:flex items-center gap-2">
        {pendingCode && (
          <motion.button
            onClick={handleSelfPing}
            title="Tap to signal your ARL which session is yours"
            animate={selfPinged ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`flex h-9 items-center gap-2 rounded-full px-4 shadow-sm backdrop-blur-sm transition-colors cursor-pointer select-none ${
              selfPinged
                ? "bg-[var(--hub-red)] text-white"
                : "bg-card/80 hover:bg-card"
            }`}
          >
            <Monitor className={`h-3.5 w-3.5 ${selfPinged ? "text-white" : "text-muted-foreground"}`} />
            <span className={`text-[10px] font-medium ${selfPinged ? "text-red-100" : "text-muted-foreground"}`}>
              {selfPinged ? "Signaled!" : "Session ID"}
            </span>
            <span className={`text-sm font-black tracking-widest ${selfPinged ? "text-white" : "text-foreground"}`}>{pendingCode}</span>
            <button
              onClick={(e) => { e.stopPropagation(); generateSession(); }}
              disabled={refreshing}
              title="Refresh session"
              className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                selfPinged ? "text-red-100 hover:bg-red-600" : "text-muted-foreground hover:text-foreground hover:bg-muted"
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </motion.button>
        )}
        <div
          onClick={handleConnectionTap}
          className="flex h-9 items-center gap-2 rounded-full bg-card/80 px-4 shadow-sm backdrop-blur-sm select-none"
        >
          {isOnline ? (
            <>
              <Wifi className="h-4 w-4 text-emerald-500" />
              <span className="text-xs font-medium text-emerald-600">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-4 w-4 text-[var(--hub-red)]" />
              <span className="text-xs font-medium text-[var(--hub-red)]">Offline</span>
            </>
          )}
        </div>
        {themeMounted && (
          <>
            <button
              onClick={cycleTheme}
              title={`Theme: ${theme}`}
              className="flex h-9 items-center gap-2 rounded-full bg-card/80 px-3 shadow-sm backdrop-blur-sm transition-colors hover:bg-card select-none"
            >
              {theme === "dark"
                ? <Moon className="h-3.5 w-3.5 text-muted-foreground" />
                : theme === "light"
                ? <Sun className="h-3.5 w-3.5 text-muted-foreground" />
                : <Monitor className="h-3.5 w-3.5 text-muted-foreground" />}
              <span className="text-[10px] font-medium capitalize text-muted-foreground">{theme}</span>
            </button>
            <BgPicker bg={bg} setBg={setBg} />
          </>
        )}
      </div>

      {/* Ping animation overlay */}
      <AnimatePresence>
        {pinged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            {[0, 1, 2].map((i) => (
              <motion.div
                key={i}
                className="absolute rounded-full border-4 border-[var(--hub-red)]"
                initial={{ width: 80, height: 80, opacity: 0.8 }}
                animate={{ width: 500, height: 500, opacity: 0 }}
                transition={{ duration: 1.2, delay: i * 0.3, ease: "easeOut" }}
              />
            ))}
            <motion.div
              initial={{ scale: 0, rotate: -20 }}
              animate={{ scale: [0, 1.3, 1], rotate: [-20, 10, 0] }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-3"
            >
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-2xl shadow-red-300">
                <span className="text-4xl">👋</span>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-card px-6 py-3 shadow-xl text-center"
              >
                <p className="text-lg font-black text-foreground">Hey, that&apos;s you!</p>
                <p className="text-sm text-muted-foreground">Your ARL is confirming your session</p>
              </motion.div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Remote activation overlay */}
      <AnimatePresence>
        {remoteActivating && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-background/90 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--hub-red)]" />
              <p className="mt-3 text-sm font-semibold text-foreground">Logging you in remotely...</p>
              <p className="text-xs text-muted-foreground">Please wait</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card container */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm my-auto rounded-3xl bg-card/90 backdrop-blur-md shadow-2xl shadow-red-100/30 border border-border px-5 py-6 sm:px-8 sm:py-10 flex flex-col items-center"
      >
        {/* Mobile-only: session ID + connection status inside card */}
        <div className="flex sm:hidden w-full justify-between items-center mb-4">
          <div
            onClick={handleConnectionTap}
            className="flex items-center gap-1.5 select-none"
          >
            {isOnline ? (
              <>
                <Wifi className="h-3.5 w-3.5 text-emerald-500" />
                <span className="text-[11px] font-medium text-emerald-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3.5 w-3.5 text-[var(--hub-red)]" />
                <span className="text-[11px] font-medium text-[var(--hub-red)]">Offline</span>
              </>
            )}
          </div>
          {pendingCode && (
            <motion.button
              onClick={handleSelfPing}
              title="Tap to signal your ARL which session is yours"
              animate={selfPinged ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-1.5 rounded-full px-2 py-1 transition-colors ${
                selfPinged ? "bg-[var(--hub-red)]" : "bg-transparent active:bg-muted"
              }`}
            >
              <Monitor className={`h-3 w-3 ${selfPinged ? "text-white" : "text-muted-foreground"}`} />
              <span className={`text-[10px] font-medium ${selfPinged ? "text-red-100" : "text-muted-foreground"}`}>
                {selfPinged ? "Signaled!" : "Session"}
              </span>
              {!selfPinged && <span className="text-xs font-black tracking-widest text-foreground">{pendingCode}</span>}
              <button
                onClick={(e) => { e.stopPropagation(); generateSession(); }}
                disabled={refreshing}
                title="Refresh session"
                className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  selfPinged ? "text-red-100" : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </motion.button>
          )}
        </div>

        {/* Icon + Title — show tenant branding when resolved */}
        {resolvedTenant?.logoUrl ? (
          <motion.img
            src={resolvedTenant.logoUrl}
            alt={`${resolvedTenant.name} logo`}
            className="mb-1 h-12 w-12 sm:h-16 sm:w-16 rounded-2xl object-contain shadow-lg shadow-red-200"
            whileHover={{ scale: 1.05 }}
          />
        ) : (
          <motion.div
            className="mb-1 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] shadow-lg shadow-red-200"
            whileHover={{ scale: 1.05 }}
          >
            <span className="text-xl sm:text-2xl font-black text-white">H</span>
          </motion.div>
        )}
        {resolvedTenant ? (
          <h1
            className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold"
            style={{ color: resolvedTenant.primaryColor || undefined }}
          >
            {resolvedTenant.name}
          </h1>
        ) : (
          <h1 className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-foreground">The Hub</h1>
        )}

        {/* Step label + dots + error */}
        <div className="mt-4 sm:mt-6 w-full">
          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 16 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -16 }}
              transition={{ duration: 0.18 }}
              className="text-center"
            >
              <p className="text-sm font-semibold text-muted-foreground">
                {step === "userId" ? "Enter your User ID" : "Enter your PIN"}
              </p>
              {step === "pin" && validatedUser && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  {validatedUser.userType === "location"
                    ? <Store className="h-3.5 w-3.5 text-muted-foreground" />
                    : <Users className="h-3.5 w-3.5 text-muted-foreground" />
                  }
                  <span className="text-xs font-semibold text-foreground">{validatedUser.name}</span>
                  {validatedUser.storeNumber && (
                    <span className="text-[10px] text-muted-foreground">#{validatedUser.storeNumber}</span>
                  )}
                </div>
              )}
              {step === "userId" && (
                <p className="mt-1 text-xs text-muted-foreground">4-digit User ID</p>
              )}
            </motion.div>
          </AnimatePresence>

          {/* Dots — shake on wrong PIN */}
          <motion.div
            key={shakeKey}
            className="mt-4 flex justify-center gap-3"
            animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >{dots}</motion.div>

          {/* Error */}
          <div className="mt-3 h-9 flex items-center justify-center">
            <AnimatePresence mode="wait">
              {error ? (
                <motion.div
                  key="err"
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.15 }}
                  className="flex w-full items-center gap-2 rounded-xl bg-red-50 px-3 py-2 text-xs text-red-600"
                >
                  <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              ) : null}
            </AnimatePresence>
          </div>
        </div>

        {/* PinPad */}
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 mt-1">
          {padButtons.map((btn) => {
            if (btn === "action") {
              if (step === "pin") {
                return (
                  <motion.button
                    key="back"
                    whileTap={{ scale: 0.92 }}
                    onClick={handleClearOrBack}
                    disabled={loading || validating}
                    className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-sm transition-colors hover:bg-muted/80 active:bg-muted disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>
                );
              }
              return (
                <motion.button
                  key="clear"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleClearOrBack}
                  disabled={loading || validating}
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-card/60 text-sm font-semibold text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card active:bg-muted disabled:opacity-50"
                >
                  Clear
                </motion.button>
              );
            }
            if (btn === "delete") {
              return (
                <motion.button
                  key="delete"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleDelete}
                  disabled={loading || validating}
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-card/60 text-muted-foreground shadow-sm backdrop-blur-sm transition-colors hover:bg-card active:bg-muted disabled:opacity-50"
                >
                  <Delete className="h-5 w-5" />
                </motion.button>
              );
            }
            const isLastDigit =
              (step === "userId" && userId.length === maxLength - 1 && btn === userId[maxLength - 1]) ||
              (step === "pin" && pin.length === maxLength);
            const showSpinner = (validating && step === "userId" && userId.length === maxLength) ||
              (loading && step === "pin" && pin.length === maxLength);
            return (
              <motion.button
                key={btn}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleDigit(btn)}
                disabled={loading || validating}
                {...(isLastDigit && step === "pin" && { "data-login-button": true })}
                className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-card text-xl font-semibold text-foreground shadow-sm transition-colors hover:bg-accent active:bg-muted disabled:opacity-50"
              >
                {showSpinner && isLastDigit ? (
                  <Loader2 className="h-5 w-5 animate-spin text-[var(--hub-red)]" />
                ) : (
                  btn
                )}
              </motion.button>
            );
          })}
        </div>

        {/* Loading state below pad */}
        <div className="mt-3 h-6 flex items-center justify-center">
          {(loading || validating) && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex items-center gap-2 text-xs text-muted-foreground"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {validating ? "Checking User ID..." : "Signing in..."}
            </motion.div>
          )}
        </div>

        {/* Change Organization link — hidden when the org is fixed by the subdomain */}
        {resolvedTenant && !lockedToSubdomain && (
          <button
            onClick={() => {
              document.cookie = "x-org-id=; path=/; max-age=0";
              localStorage.removeItem("hub-org-id");
              setOrgSlug(null);
              setResolvedTenant(null);
              setStep("userId");
              setValidatedUser(null);
              userIdRef.current = "";
              setUserId("");
              pinRef.current = "";
              setPin("");
              setError("");
            }}
            className="mt-4 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            Not {resolvedTenant.name}?{" "}
            <span className="underline">Change organization</span>
          </button>
        )}
      </motion.div>

      {/* ---- Staff lockout bypass dialog ---------------------------------- */}
      {/* Triggered by 5 rapid taps on the logo. Not shown in normal usage.  */}
      <AnimatePresence>
        {showBypass && (
          <motion.div
            key="bypass-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 px-4 backdrop-blur-sm"
            onClick={(e) => {
              if (e.target === e.currentTarget && !bypassLoading) closeBypassDialog();
            }}
          >
            <motion.div
              initial={{ scale: 0.92, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.92, opacity: 0 }}
              transition={{ type: "spring", stiffness: 340, damping: 28 }}
              className="w-full max-w-[280px] rounded-3xl bg-card px-6 py-8 shadow-2xl border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-2 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-base font-bold text-foreground">Staff Unlock</h2>
                <p className="text-[11px] text-muted-foreground text-center leading-relaxed">
                  Enter the 4-digit bypass code to reset the login lockout
                </p>
              </div>

              <AnimatePresence mode="wait">
                {bypassDone ? (
                  /* Success state */
                  <motion.div
                    key="done"
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="flex flex-col items-center gap-2 py-4"
                  >
                    <CheckCircle2 className="h-12 w-12 text-emerald-500" />
                    <p className="text-sm font-semibold text-foreground">Lockout cleared!</p>
                    <p className="text-xs text-muted-foreground">You may try again now</p>
                  </motion.div>
                ) : (
                  <motion.div key="form">
                    {/* Dots */}
                    <div className="flex justify-center gap-3 mb-4">
                      {[0, 1, 2, 3].map((i) => (
                        <div
                          key={i}
                          className={`h-3 w-3 rounded-full transition-all duration-150 ${
                            i < bypassCode.length
                              ? "bg-foreground scale-110"
                              : "bg-muted"
                          }`}
                        />
                      ))}
                    </div>

                    {/* Error */}
                    <div className="min-h-[2rem] mb-2">
                      <AnimatePresence mode="wait">
                        {bypassError && (
                          <motion.div
                            key="bypass-err"
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 0.15 }}
                            className="flex items-center gap-2 rounded-xl bg-red-50 px-3 py-1.5 text-xs text-red-600"
                          >
                            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                            <span>{bypassError}</span>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>

                    {/* Numpad: 1-9, Cancel, 0, Delete */}
                    <div className="grid grid-cols-3 gap-2">
                      {(["1","2","3","4","5","6","7","8","9","cancel","0","delete"] as const).map((btn) => {
                        if (btn === "cancel") {
                          return (
                            <motion.button
                              key="cancel"
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={closeBypassDialog}
                              disabled={bypassLoading}
                              className="flex h-12 items-center justify-center rounded-2xl bg-muted text-xs font-semibold text-muted-foreground shadow-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
                            >
                              Cancel
                            </motion.button>
                          );
                        }
                        if (btn === "delete") {
                          return (
                            <motion.button
                              key="delete"
                              type="button"
                              whileTap={{ scale: 0.92 }}
                              onClick={handleBypassDelete}
                              disabled={bypassLoading}
                              className="flex h-12 items-center justify-center rounded-2xl bg-muted text-muted-foreground shadow-sm transition-colors hover:bg-muted/80 disabled:opacity-50"
                            >
                              <Delete className="h-4 w-4" />
                            </motion.button>
                          );
                        }
                        const isSubmitting = bypassLoading && bypassCode.length === 4;
                        return (
                          <motion.button
                            key={btn}
                            type="button"
                            whileTap={{ scale: 0.92 }}
                            onClick={() => handleBypassDigit(btn)}
                            disabled={bypassLoading || bypassCode.length >= 4}
                            className="flex h-12 items-center justify-center rounded-2xl border border-border bg-card text-lg font-semibold text-foreground shadow-sm transition-colors hover:bg-accent active:bg-muted disabled:opacity-50"
                          >
                            {isSubmitting && bypassCode[bypassCode.length - 1] === btn ? (
                              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                            ) : (
                              btn
                            )}
                          </motion.button>
                        );
                      })}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
