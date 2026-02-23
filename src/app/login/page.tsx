"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useSocket } from "@/lib/socket-context";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2, AlertCircle, Wifi, WifiOff, ChevronLeft, Store, Users, Monitor, RefreshCw } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type LoginStep = "userId" | "pin";

interface ValidatedUser {
  userType: "location" | "arl";
  name: string;
  storeNumber?: string;
  role?: string;
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
  const userIdRef = useRef("");
  const pinRef = useRef("");
  const keyboardInputRef = useRef<HTMLInputElement>(null);

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
              setError(data.error || "User ID not found");
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

    const result = await login(uid, p);

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

  return (
    <div className="min-h-screen min-h-dvh w-screen overflow-y-auto bg-gradient-to-br from-[#fef2f2] via-[#fff7ed] to-[#fefce8] flex flex-col items-center justify-center py-6 px-4">
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
        className="w-full max-w-sm rounded-3xl bg-white/80 backdrop-blur-md shadow-2xl shadow-red-100/40 border border-white px-5 py-6 sm:px-8 sm:py-10 flex flex-col items-center"
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

        {/* Icon + Title */}
        <motion.div
          className="mb-1 flex h-12 w-12 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] shadow-lg shadow-red-200"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-xl sm:text-2xl font-black text-white">H</span>
        </motion.div>
        <h1 className="mt-2 sm:mt-3 text-xl sm:text-2xl font-bold text-slate-800">The Hub</h1>

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
                <p className="mt-1 text-xs text-slate-400">6-digit User ID</p>
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
      </motion.div>
    </div>
  );
}
