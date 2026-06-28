"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";
import { setReloadBlocked } from "@/lib/reload-guard";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2, AlertCircle, Wifi, WifiOff, ChevronLeft, Store, Users, Monitor, RefreshCw, Keyboard, Lock, CheckCircle2, Sun, Moon } from "@/lib/icons";
import { useTheme } from "next-themes";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { useAuth } from "@/lib/auth-context";
import { HubMark } from "@/components/icons/hub-mark";

type LoginStep = "userId" | "pin";

const HUB_DOMAINS = ["meetthehub.com"];

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

// Shared by both layoutId="login-card" elements so the morph's actual
// duration and the content-fade delay can never drift apart. A spring
// parametrized by duration+bounce (rather than stiffness/damping) keeps the
// gentle settle this card already had while making that duration knowable —
// stiffness/damping springs don't have a fixed stop time, which is what let
// content fade in before the box was actually done resizing.
const CARD_MORPH_TRANSITION = { type: "spring", duration: 0.5, bounce: 0 } as const;
const CARD_MORPH_MS = 550;

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
  const themeLabel = theme ? theme[0].toUpperCase() + theme.slice(1) : "System";

  const [step, setStep] = useState<LoginStep>("userId");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedUser, setValidatedUser] = useState<ValidatedUser | null>(null);
  const { isConnected: isOnline } = useSocket();

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

  // Card content (headline, inputs, pad) fades in only after the
  // layoutId="login-card" morph between the org-slug card and the PIN-pad
  // card has finished — otherwise text rides along with the still-resizing
  // container and visibly stretches. Defaults true: the very first card
  // rendered each session (whichever one it is) has nothing to morph from,
  // so its content should appear immediately, not wait on a transition that
  // never happens. Only the two explicit user-triggered swaps (org submitted
  // successfully, "Change organization" clicked) set it false and schedule
  // it back to true once CARD_MORPH_MS has elapsed.
  const [contentVisible, setContentVisible] = useState(true);

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
        setContentVisible(false);
        setOrgSlug(tenant.slug);
        setResolvedTenant(tenant);
        localStorage.setItem("hub-org-id", tenant.slug);
        document.cookie = `x-org-id=${tenant.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
        applyBranding(tenant);
        setTimeout(() => setContentVisible(true), CARD_MORPH_MS);
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
      <div className={`min-h-screen min-h-dvh w-screen overflow-y-auto bg-background flex flex-col items-center py-6 px-4 justify-center ${showOrgKeyboard ? "max-sm:justify-start max-sm:pt-12" : ""}`}>
        {/* Spacer to push content above keyboard on mobile */}
        {showOrgKeyboard && <div className="flex-1 min-h-4 sm:hidden" />}

        {/* Card — layoutId="login-card" morphs into the PIN pad card when
            the org is confirmed. Same key on both ends; Framer Motion
            animates size + position between the two renders. */}
        <motion.div
          layoutId="login-card"
          transition={CARD_MORPH_TRANSITION}
          className="relative w-full max-w-sm rounded-3xl bg-card border border-border px-5 py-4 sm:px-6 sm:py-5 flex flex-col items-center"
        >
          {/* Theme toggle in card corner — same position as the login card
              so it stays put during the morph instead of jumping. */}
          {themeMounted && (
            <button
              onClick={cycleTheme}
              title={`Theme: ${themeLabel}`}
              className="absolute right-4 top-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted select-none"
            >
              {theme === "dark"
                ? <Moon className="h-3.5 w-3.5" />
                : theme === "light"
                ? <Sun className="h-3.5 w-3.5" />
                : <Monitor className="h-3.5 w-3.5" />}
            </button>
          )}

          {/* Hub mark — layoutId="hub-mark" keeps it pinned in the same
              spot while the card expands around it. */}
          <motion.div
            layoutId="hub-mark"
            className="mb-1 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] text-white"
          >
            <HubMark className="h-7 w-7 sm:h-8 sm:w-8" />
          </motion.div>

          {/* Headline + input fade in only once the morph from/to the PIN-pad
              card has settled (see CARD_MORPH_TRANSITION/contentVisible) —
              otherwise this text rides along with the still-resizing card
              and visibly stretches instead of just appearing. `initial` has
              to mirror `animate`'s current value explicitly — without it,
              Framer Motion animates the first paint in from the CSS default
              (opacity 1) regardless of what `animate` already says, which
              produced a visible flash-then-fade-out before this was added. */}
          <motion.div
            initial={{ opacity: contentVisible ? 1 : 0 }}
            animate={{ opacity: contentVisible ? 1 : 0 }}
            transition={{ duration: 0.25, ease: "easeOut" }}
            className="w-full flex flex-col items-center"
          >
          <h1 className="mt-2 sm:mt-3 text-2xl font-semibold text-foreground">Welcome to The Hub</h1>

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
                className="w-full max-w-[240px] rounded-2xl border border-border bg-background px-4 py-3 text-center text-lg font-semibold tracking-widest text-foreground outline-none focus:border-[var(--hub-red)] focus:ring-2 focus:ring-[var(--hub-red)]/20 transition-colors placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
              />
              <button
                onClick={() => setShowOrgKeyboard((v) => !v)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                  showOrgKeyboard
                    ? "bg-[var(--hub-red)] text-white"
                    : "bg-muted text-muted-foreground active:bg-muted/80 active:text-foreground"
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
                  className="mt-3 flex w-full items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
          </motion.div>{/* /fade wrapper */}
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

      {/* Ping animation overlay */}
      <AnimatePresence>
        {pinged && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex items-center justify-center pointer-events-none"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="relative flex flex-col items-center gap-3"
            >
              <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[var(--hub-red)]">
                <CheckCircle2 className="h-9 w-9 text-white" />
              </div>
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl bg-card border border-border px-6 py-3 shadow-sm text-center"
              >
                <p className="text-lg font-semibold text-foreground">That&apos;s you</p>
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

      {/* Card — receives the morph from the org slug card via layoutId */}
      <motion.div
        layoutId="login-card"
        transition={CARD_MORPH_TRANSITION}
        className="relative w-full max-w-sm my-auto rounded-3xl bg-card border border-border px-5 py-6 sm:px-8 sm:py-10 flex flex-col items-center"
      >
        {/* Hub mark / tenant logo — stays anchored in place while the card
            morphs; only the card shell around it grows. */}
        {resolvedTenant?.logoUrl ? (
          <motion.img
            layoutId="hub-mark"
            src={resolvedTenant.logoUrl}
            alt={`${resolvedTenant.name} logo`}
            className="mb-1 h-12 w-12 sm:h-16 sm:w-16 rounded-2xl object-contain"
          />
        ) : (
          <motion.div
            layoutId="hub-mark"
            className="mb-1 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] text-white"
          >
            <HubMark className="h-7 w-7 sm:h-9 sm:w-9" />
          </motion.div>
        )}

        {/* Content fades in only once the morph has settled (contentVisible,
            tied to CARD_MORPH_MS) — prevents the PIN pad from riding along
            with the still-resizing card instead of just appearing in it.
            `initial` mirrors `animate` explicitly — see the matching comment
            on the org-card's fade wrapper for why this is required, not
            optional, given contentVisible is already false at this mount. */}
        <motion.div
          initial={{ opacity: contentVisible ? 1 : 0 }}
          animate={{ opacity: contentVisible ? 1 : 0 }}
          transition={{ duration: 0.25, ease: "easeOut" }}
          className="w-full flex flex-col items-center"
        >
        {resolvedTenant ? (
          <h1
            className="mt-2 sm:mt-3 text-2xl font-semibold"
            style={{ color: resolvedTenant.primaryColor || undefined }}
          >
            {resolvedTenant.name}
          </h1>
        ) : (
          <h1 className="mt-2 sm:mt-3 text-2xl font-semibold text-foreground">The Hub</h1>
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
            </motion.div>
          </AnimatePresence>

          {/* Always-present name row — keeps height constant so the container
              never jumps when transitioning from userId → PIN. Fades in once
              validated; opacity-0 + pointer-events-none hides it otherwise. */}
          <div className={`mt-2 flex items-center justify-center gap-1 transition-opacity duration-200 ${
            step === "pin" && validatedUser ? "opacity-100" : "opacity-0 pointer-events-none"
          }`}>
            {validatedUser?.userType === "location"
              ? <Store className="h-3.5 w-3.5 text-muted-foreground" />
              : <Users className="h-3.5 w-3.5 text-muted-foreground" />
            }
            <span className="text-xs font-semibold text-foreground">{validatedUser?.name}</span>
            {validatedUser?.storeNumber && (
              <span className="text-xs text-muted-foreground">#{validatedUser.storeNumber}</span>
            )}
          </div>

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
                  className="flex w-full items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
              // Stable key so React updates content in-place (no unmount/remount
              // flash when switching between the back arrow and "Clear" text).
              return (
                <motion.button
                  key="action"
                  whileTap={{ scale: 0.92 }}
                  onClick={handleClearOrBack}
                  disabled={loading || validating}
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl border border-border bg-background text-sm font-semibold text-muted-foreground transition-colors active:bg-muted disabled:opacity-50"
                >
                  {step === "pin" ? <ChevronLeft className="h-5 w-5" /> : "Clear"}
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
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors active:bg-muted disabled:opacity-50"
                >
                  <Delete className="h-5 w-5" />
                </motion.button>
              );
            }
            const isLastDigit = step === "pin" && pin.length === maxLength && btn === pin[maxLength - 1];
            return (
              <motion.button
                key={btn}
                whileTap={{ scale: 0.92 }}
                onClick={() => handleDigit(btn)}
                disabled={loading || validating}
                {...(isLastDigit && { "data-login-button": true })}
                className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-background text-lg font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-50"
              >
                {btn}
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

        {/* Footer status row: connection + session pairing — both are
            specific to this login attempt, right now, so they're one real
            group, centered together. Theme is a global, persistent
            preference unrelated to this particular login flow — it lives
            in the card's top-right corner instead (see below), matching
            the standard convention for app-level settings. */}
        <div className="mt-4 w-full flex items-center justify-center gap-3">
          <div
            onClick={handleConnectionTap}
            className="flex items-center gap-1 select-none shrink-0"
          >
            {isOnline ? (
              <>
                <Wifi className="h-3 w-3 text-emerald-500" />
                <span className="text-xs font-semibold text-emerald-600">Connected</span>
              </>
            ) : (
              <>
                <WifiOff className="h-3 w-3 text-[var(--hub-red)]" />
                <span className="text-xs font-semibold text-[var(--hub-red)]">Offline</span>
              </>
            )}
          </div>
          {pendingCode && (
            <motion.button
              onClick={handleSelfPing}
              title="Tap to signal your ARL which session is yours"
              animate={selfPinged ? { scale: [1, 1.06, 1] } : {}}
              transition={{ duration: 0.3 }}
              className={`flex items-center gap-1 rounded-2xl px-2 py-1 transition-colors min-w-0 ${
                selfPinged ? "bg-[var(--hub-red)]" : "bg-transparent active:bg-muted"
              }`}
            >
              <Monitor className={`h-3 w-3 shrink-0 ${selfPinged ? "text-white" : "text-muted-foreground"}`} />
              <span className={`text-xs font-semibold truncate ${selfPinged ? "text-red-100" : "text-muted-foreground"}`}>
                {selfPinged ? "Signaled!" : "Session"}
              </span>
              {!selfPinged && <span className="font-mono text-xs font-black tracking-widest text-foreground shrink-0">{pendingCode}</span>}
              <button
                onClick={(e) => { e.stopPropagation(); generateSession(); }}
                disabled={refreshing}
                title="Refresh session"
                className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  selfPinged ? "text-red-100" : "text-muted-foreground"
                }`}
              >
                <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
              </button>
            </motion.button>
          )}
        </div>

        {/* Change Organization link — hidden when the org is fixed by the
            subdomain. Lives inside the fade wrapper too: it's text content
            of this card just like the headline/pad, so it shouldn't pop in
            ahead of the morph completing either. */}
        {resolvedTenant && !lockedToSubdomain && (
          <button
            onClick={() => {
              setContentVisible(false);
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
              setTimeout(() => setContentVisible(true), CARD_MORPH_MS);
            }}
            className="mt-4 text-xs text-muted-foreground active:text-foreground transition-colors"
          >
            Not {resolvedTenant.name}?{" "}
            <span className="underline">Change organization</span>
          </button>
        )}

        </motion.div>{/* /fade wrapper */}

        {/* Theme toggle — anchored to the card's top-right corner, not the
            screen's, so it stays in one consistent position across
            breakpoints without separate desktop/mobile code. */}
        {themeMounted && (
          <button
            onClick={cycleTheme}
            title={`Theme: ${themeLabel}`}
            className="absolute right-4 top-4 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-muted-foreground transition-colors active:bg-muted select-none"
          >
            {theme === "dark"
              ? <Moon className="h-3.5 w-3.5" />
              : theme === "light"
              ? <Sun className="h-3.5 w-3.5" />
              : <Monitor className="h-3.5 w-3.5" />}
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
              className="w-full max-w-[280px] rounded-3xl bg-card px-6 py-8 shadow-lg border border-border"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex flex-col items-center gap-2 mb-5">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                  <Lock className="h-6 w-6 text-muted-foreground" />
                </div>
                <h2 className="text-lg font-semibold text-foreground">Staff Unlock</h2>
                <p className="text-xs text-muted-foreground text-center leading-relaxed">
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
                            className="flex items-center gap-2 rounded-2xl bg-destructive/10 px-3 py-2 text-xs text-destructive"
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
                              className="flex h-12 items-center justify-center rounded-2xl border border-border bg-background text-xs font-semibold text-muted-foreground transition-colors active:bg-muted/80 disabled:opacity-50"
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
                              className="flex h-12 items-center justify-center rounded-2xl border border-border bg-background text-muted-foreground transition-colors active:bg-muted/80 disabled:opacity-50"
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
                            className="flex h-12 items-center justify-center rounded-2xl bg-background text-lg font-semibold text-foreground transition-colors active:bg-muted disabled:opacity-50"
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
