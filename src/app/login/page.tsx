"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2, AlertCircle, Wifi, WifiOff, ChevronLeft, Store, Users, Monitor, RefreshCw, Keyboard } from "@/lib/icons";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { useAuth } from "@/lib/auth-context";

type LoginStep = "userId" | "pin";

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

export default function LoginPage() {
  const { login } = useAuth();
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

  const userIdRef = useRef("");
  const pinRef = useRef("");
  const keyboardInputRef = useRef<HTMLInputElement>(null);
  const orgInputRef = useRef<HTMLInputElement>(null);

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
              : "border-slate-300 bg-white"
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
      <div className="min-h-screen min-h-dvh w-screen bg-gradient-to-br from-[#fef2f2] via-[#fff7ed] to-[#fefce8] flex flex-col items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--hub-red)]" />
      </div>
    );
  }

  // Org Entry Screen — no org slug resolved yet
  if (orgChecked && !orgSlug) {
    return (
      <div className={`min-h-screen min-h-dvh w-screen overflow-y-auto bg-gradient-to-br from-[#fef2f2] via-[#fff7ed] to-[#fefce8] flex flex-col items-center py-6 px-4 ${showOrgKeyboard ? "justify-start pt-12" : "justify-center"}`}>
        {/* Spacer to push content above keyboard on mobile */}
        {showOrgKeyboard && <div className="flex-1 min-h-4" />}
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
          className="w-full max-w-sm rounded-3xl bg-white/80 backdrop-blur-md shadow-2xl shadow-red-100/40 border border-white px-5 py-4 sm:px-6 sm:py-5 flex flex-col items-center"
        >
          <h1 className="text-xl sm:text-2xl font-bold text-slate-800">Welcome to The Hub</h1>

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
                className="w-full max-w-[240px] rounded-xl border border-slate-200 bg-white px-4 py-3 text-center text-lg font-bold tracking-widest text-slate-800 outline-none focus:border-[var(--hub-red)] focus:ring-2 focus:ring-[var(--hub-red)]/20 transition-colors placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-sm"
              />
              <button
                onClick={() => setShowOrgKeyboard((v) => !v)}
                className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
                  showOrgKeyboard
                    ? "bg-[var(--hub-red)] text-white shadow-md"
                    : "bg-slate-100 text-slate-400 hover:bg-slate-200 hover:text-slate-600"
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
                className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400"
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
    <div className="min-h-screen min-h-dvh w-screen overflow-y-auto bg-gradient-to-br from-[#fef2f2] via-[#fff7ed] to-[#fefce8] flex flex-col items-center py-6 px-4">
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

      {/* Top bar: connection + session ID — hidden on mobile (shown inside card instead) */}
      <div className="absolute right-4 top-4 hidden sm:flex items-center gap-3">
        {pendingCode && (
          <motion.button
            onClick={handleSelfPing}
            title="Tap to signal your ARL which session is yours"
            animate={selfPinged ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-2 rounded-full px-4 py-2 shadow-sm backdrop-blur-sm transition-colors cursor-pointer select-none ${
              selfPinged
                ? "bg-[var(--hub-red)] text-white"
                : "bg-white/80 hover:bg-white"
            }`}
          >
            <Monitor className={`h-3.5 w-3.5 ${selfPinged ? "text-white" : "text-slate-400"}`} />
            <span className={`text-[10px] font-medium ${selfPinged ? "text-red-100" : "text-slate-400"}`}>
              {selfPinged ? "Signaled!" : "Session ID"}
            </span>
            <span className={`text-sm font-black tracking-widest ${selfPinged ? "text-white" : "text-slate-700"}`}>{pendingCode}</span>
            <button
              onClick={(e) => { e.stopPropagation(); generateSession(); }}
              disabled={refreshing}
              title="Refresh session"
              className={`ml-1 flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                selfPinged ? "text-red-100 hover:bg-red-600" : "text-slate-400 hover:text-slate-600 hover:bg-slate-100"
              }`}
            >
              <RefreshCw className={`h-3 w-3 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </motion.button>
        )}
        <div className="flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-sm backdrop-blur-sm">
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
                className="rounded-2xl bg-white px-6 py-3 shadow-xl text-center"
              >
                <p className="text-lg font-black text-slate-800">Hey, that&apos;s you!</p>
                <p className="text-sm text-slate-500">Your ARL is confirming your session</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-white/90 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--hub-red)]" />
              <p className="mt-3 text-sm font-semibold text-slate-700">Logging you in remotely...</p>
              <p className="text-xs text-slate-400">Please wait</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Card container */}
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: "easeOut" }}
        className="w-full max-w-sm my-auto rounded-3xl bg-white/80 backdrop-blur-md shadow-2xl shadow-red-100/40 border border-white px-5 py-6 sm:px-8 sm:py-10 flex flex-col items-center"
      >
        {/* Mobile-only: session ID + connection status inside card */}
        <div className="flex sm:hidden w-full justify-between items-center mb-4">
          <div className="flex items-center gap-1.5">
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
                selfPinged ? "bg-[var(--hub-red)]" : "bg-transparent active:bg-slate-100"
              }`}
            >
              <Monitor className={`h-3 w-3 ${selfPinged ? "text-white" : "text-slate-400"}`} />
              <span className={`text-[10px] font-medium ${selfPinged ? "text-red-100" : "text-slate-400"}`}>
                {selfPinged ? "Signaled!" : "Session"}
              </span>
              {!selfPinged && <span className="text-xs font-black tracking-widest text-slate-700">{pendingCode}</span>}
              <button
                onClick={(e) => { e.stopPropagation(); generateSession(); }}
                disabled={refreshing}
                title="Refresh session"
                className={`flex h-5 w-5 items-center justify-center rounded-full transition-colors disabled:opacity-50 ${
                  selfPinged ? "text-red-100" : "text-slate-400 hover:text-slate-600"
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
          <h1 className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-slate-800">The Hub</h1>
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
              <p className="text-sm font-semibold text-slate-600">
                {step === "userId" ? "Enter your User ID" : "Enter your PIN"}
              </p>
              {step === "pin" && validatedUser && (
                <div className="mt-1.5 flex items-center justify-center gap-1.5">
                  {validatedUser.userType === "location"
                    ? <Store className="h-3.5 w-3.5 text-slate-400" />
                    : <Users className="h-3.5 w-3.5 text-slate-400" />
                  }
                  <span className="text-xs font-semibold text-slate-700">{validatedUser.name}</span>
                  {validatedUser.storeNumber && (
                    <span className="text-[10px] text-slate-400">#{validatedUser.storeNumber}</span>
                  )}
                </div>
              )}
              {step === "userId" && (
                <p className="mt-1 text-xs text-slate-400">4-digit User ID</p>
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
                    className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-slate-100 text-slate-500 shadow-sm transition-colors hover:bg-slate-200 active:bg-slate-300 disabled:opacity-50"
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
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/60 text-sm font-semibold text-slate-500 shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:bg-slate-100 disabled:opacity-50"
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
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/60 text-slate-500 shadow-sm backdrop-blur-sm transition-colors hover:bg-white active:bg-slate-100 disabled:opacity-50"
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
                className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white text-xl font-semibold text-slate-700 shadow-sm transition-colors hover:bg-slate-50 active:bg-slate-100 disabled:opacity-50"
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
              className="flex items-center gap-2 text-xs text-slate-400"
            >
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {validating ? "Checking User ID..." : "Signing in..."}
            </motion.div>
          )}
        </div>

        {/* Change Organization link */}
        {resolvedTenant && (
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
            className="mt-4 text-xs text-slate-400 hover:text-slate-600 transition-colors"
          >
            Not {resolvedTenant.name}?{" "}
            <span className="underline">Change organization</span>
          </button>
        )}
      </motion.div>
    </div>
  );
}
