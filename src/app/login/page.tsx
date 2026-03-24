"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { useSocket } from "@/lib/socket-context";
import { motion, AnimatePresence } from "framer-motion";
import { Delete, Loader2, AlertCircle, Wifi, WifiOff, ChevronLeft, Store, Users, Monitor, RefreshCw, Keyboard, Star } from "@/lib/icons";
import { OnscreenKeyboard } from "@/components/keyboard/onscreen-keyboard";
import { useAuth } from "@/lib/auth-context";
import { ConstellationGrid } from "@/components/auth/constellation-grid";

// ── Types ───────────────────────────────────────────────────────

type CardState = "org" | "userId" | "pin" | "pattern";
type AuthMode = "pin" | "pattern";

interface ValidatedUser {
  userType: "location" | "arl";
  name: string;
  storeNumber?: string;
  role?: string;
  hasPattern?: boolean;
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

// ── Mesh Gradient CSS ───────────────────────────────────────────

const MESH_GRADIENT_STYLES = `
@property --mesh-a {
  syntax: '<percentage>';
  initial-value: 20%;
  inherits: false;
}
@property --mesh-b {
  syntax: '<percentage>';
  initial-value: 80%;
  inherits: false;
}
@property --mesh-c {
  syntax: '<percentage>';
  initial-value: 50%;
  inherits: false;
}
@property --mesh-d {
  syntax: '<percentage>';
  initial-value: 30%;
  inherits: false;
}

@keyframes mesh-morph {
  0% { --mesh-a: 20%; --mesh-b: 80%; --mesh-c: 50%; --mesh-d: 30%; }
  25% { --mesh-a: 60%; --mesh-b: 30%; --mesh-c: 70%; --mesh-d: 60%; }
  50% { --mesh-a: 40%; --mesh-b: 60%; --mesh-c: 20%; --mesh-d: 80%; }
  75% { --mesh-a: 70%; --mesh-b: 40%; --mesh-c: 60%; --mesh-d: 20%; }
  100% { --mesh-a: 20%; --mesh-b: 80%; --mesh-c: 50%; --mesh-d: 30%; }
}

.mesh-gradient-bg {
  background:
    radial-gradient(ellipse at var(--mesh-a) var(--mesh-d), rgba(228,0,43,0.15) 0%, transparent 50%),
    radial-gradient(ellipse at var(--mesh-b) var(--mesh-c), rgba(217,119,6,0.1) 0%, transparent 50%),
    radial-gradient(ellipse at var(--mesh-c) var(--mesh-a), rgba(100,116,139,0.08) 0%, transparent 50%),
    radial-gradient(ellipse at var(--mesh-d) var(--mesh-b), rgba(5,150,105,0.06) 0%, transparent 50%),
    hsl(var(--bg-base-h), var(--bg-base-s), var(--bg-base-l));
  animation: mesh-morph 20s ease-in-out infinite;
}

.mesh-gradient-fallback {
  background:
    radial-gradient(ellipse at 30% 20%, rgba(228,0,43,0.12) 0%, transparent 50%),
    radial-gradient(ellipse at 70% 80%, rgba(217,119,6,0.08) 0%, transparent 50%),
    hsl(var(--bg-base-h), var(--bg-base-s), var(--bg-base-l));
}
`;

// ── Mesh gradient support detection ─────────────────────────────

function useMeshGradientSupport() {
  const [supported, setSupported] = useState(false);
  useEffect(() => {
    try {
      setSupported(
        typeof CSS !== "undefined" &&
        typeof CSS.supports === "function" &&
        CSS.supports("(animation-name: mesh-morph)") &&
        CSS.supports("background", "radial-gradient(ellipse at 50% 50%, red, transparent)")
      );
    } catch {
      setSupported(false);
    }
  }, []);
  return supported;
}

// ── PIN Progress Bar ────────────────────────────────────────────

function PinProgressBar({ filled, total }: { filled: number; total: number }) {
  const progress = total > 0 ? (filled / total) * 100 : 0;
  return (
    <div className="w-full max-w-[200px] mx-auto">
      <div className="h-2 w-full rounded-full bg-white/10 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ background: "var(--hub-red)" }}
          initial={false}
          animate={{ width: `${progress}%` }}
          transition={{ type: "spring", stiffness: 300, damping: 25 }}
        />
      </div>
      <div className="flex justify-between mt-1.5">
        {Array.from({ length: total }, (_, i) => (
          <motion.div
            key={i}
            className="h-1 w-1 rounded-full"
            animate={{
              backgroundColor: i < filled ? "var(--hub-red)" : "rgba(255,255,255,0.2)",
              scale: i === filled - 1 && filled > 0 ? [1, 1.5, 1] : 1,
            }}
            transition={{ duration: 0.15 }}
          />
        ))}
      </div>
    </div>
  );
}

// ── Session Code Footer Strip ───────────────────────────────────

function SessionCodeFooter({
  pendingCode,
  selfPinged,
  onSelfPing,
  onRefresh,
  refreshing,
  isOnline,
}: {
  pendingCode: string | null;
  selfPinged: boolean;
  onSelfPing: () => void;
  onRefresh: () => void;
  refreshing: boolean;
  isOnline: boolean;
}) {
  if (!pendingCode && !isOnline) return null;
  return (
    <div className="mt-auto pt-3 w-full border-t border-white/10">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5">
          {isOnline ? (
            <>
              <Wifi className="h-3 w-3 text-emerald-400" />
              <span className="text-[10px] font-medium text-emerald-400">Connected</span>
            </>
          ) : (
            <>
              <WifiOff className="h-3 w-3 text-red-400" />
              <span className="text-[10px] font-medium text-red-400">Offline</span>
            </>
          )}
        </div>
        {pendingCode && (
          <motion.button
            onClick={onSelfPing}
            animate={selfPinged ? { scale: [1, 1.06, 1] } : {}}
            transition={{ duration: 0.3 }}
            className={`flex items-center gap-1.5 rounded-full px-2.5 py-1 transition-colors ${
              selfPinged
                ? "bg-[var(--hub-red)] text-white"
                : "bg-white/5 hover:bg-white/10 text-white/60"
            }`}
          >
            <Monitor className={`h-3 w-3 ${selfPinged ? "text-white" : "text-white/40"}`} />
            <span className="text-[10px] font-medium">
              {selfPinged ? "Signaled!" : "Session"}
            </span>
            {!selfPinged && (
              <span className="text-xs font-black tracking-widest text-white/80">{pendingCode}</span>
            )}
            <button
              onClick={(e) => { e.stopPropagation(); onRefresh(); }}
              disabled={refreshing}
              className="ml-0.5 flex h-4 w-4 items-center justify-center rounded-full transition-colors disabled:opacity-50 text-white/40 hover:text-white/60"
            >
              <RefreshCw className={`h-2.5 w-2.5 ${refreshing ? "animate-spin" : ""}`} />
            </button>
          </motion.button>
        )}
      </div>
    </div>
  );
}

// ── Card Content Components ─────────────────────────────────────

/** Org entry content */
function OrgContent({
  orgInput,
  orgError,
  orgLoading,
  showOrgKeyboard,
  onOrgInputChange,
  onOrgSubmit,
  onToggleKeyboard,
  orgInputRef,
}: {
  orgInput: string;
  orgError: string;
  orgLoading: boolean;
  showOrgKeyboard: boolean;
  onOrgInputChange: (val: string) => void;
  onOrgSubmit: () => void;
  onToggleKeyboard: () => void;
  orgInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  return (
    <motion.div
      key="org-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center w-full"
    >
      <motion.div
        className="mb-3 flex h-14 w-14 sm:h-16 sm:w-16 items-center justify-center rounded-2xl bg-[var(--hub-red)] shadow-lg shadow-red-900/30"
        whileHover={{ scale: 1.05 }}
      >
        <span className="text-2xl sm:text-3xl font-black text-white">H</span>
      </motion.div>
      <h1 className="text-xl sm:text-2xl font-black text-white">Welcome to The Hub</h1>
      <div className="mt-4 w-full">
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
              onOrgInputChange(val);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") { e.preventDefault(); onOrgSubmit(); }
            }}
            style={{ textTransform: "uppercase" }}
            className="w-full max-w-[240px] rounded-xl border border-white/20 bg-white/10 backdrop-blur-sm px-4 py-3 text-center text-lg font-bold tracking-widest text-white outline-none focus:border-[var(--hub-red)] focus:ring-2 focus:ring-[var(--hub-red)]/30 transition-colors placeholder:normal-case placeholder:font-normal placeholder:tracking-normal placeholder:text-sm placeholder:text-white/40"
          />
          <button
            onClick={onToggleKeyboard}
            className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full transition-colors ${
              showOrgKeyboard
                ? "bg-[var(--hub-red)] text-white shadow-md"
                : "bg-white/10 text-white/40 hover:bg-white/20 hover:text-white/60"
            }`}
            title={showOrgKeyboard ? "Hide virtual keyboard" : "Show virtual keyboard"}
          >
            <Keyboard className="h-5 w-5" />
          </button>
        </div>
        <AnimatePresence mode="wait">
          {orgError && (
            <motion.div
              key="org-err"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="mt-3 flex w-full items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-xs text-red-300"
            >
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>{orgError}</span>
            </motion.div>
          )}
        </AnimatePresence>
        {orgLoading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="mt-2 flex items-center justify-center gap-2 text-xs text-white/40"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Validating organization...
          </motion.div>
        )}
      </div>
    </motion.div>
  );
}

/** User ID / PIN / Pattern content */
function AuthContent({
  cardState,
  userId,
  pin,
  error,
  loading,
  validating,
  validatedUser,
  authMode,
  patternError,
  shakeKey,
  resolvedTenant,
  onDigit,
  onDelete,
  onClearOrBack,
  onPatternSubmit,
  onGoBackToUserId,
  onSwitchToPin,
  onSwitchToPattern,
  onChangeOrg,
  keyboardInputRef,
}: {
  cardState: CardState;
  userId: string;
  pin: string;
  error: string;
  loading: boolean;
  validating: boolean;
  validatedUser: ValidatedUser | null;
  authMode: AuthMode;
  patternError: boolean;
  shakeKey: number;
  resolvedTenant: ResolvedTenant | null;
  onDigit: (d: string) => void;
  onDelete: () => void;
  onClearOrBack: () => void;
  onPatternSubmit: (pattern: number[]) => void;
  onGoBackToUserId: () => void;
  onSwitchToPin: () => void;
  onSwitchToPattern: () => void;
  onChangeOrg: () => void;
  keyboardInputRef: React.RefObject<HTMLInputElement | null>;
}) {
  const maxLength = 4;
  const currentValue = cardState === "userId" ? userId : pin;
  const padButtons = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "action", "0", "delete"];

  return (
    <motion.div
      key="auth-content"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      transition={{ duration: 0.2 }}
      className="flex flex-col items-center w-full"
    >
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
        style={{ position: "absolute", left: -9999 }}
      />

      {/* Icon + Title */}
      {resolvedTenant?.logoUrl ? (
        <motion.img
          src={resolvedTenant.logoUrl}
          alt={`${resolvedTenant.name} logo`}
          className="mb-1 h-12 w-12 sm:h-14 sm:w-14 rounded-2xl object-contain"
          whileHover={{ scale: 1.05 }}
        />
      ) : (
        <motion.div
          className="mb-1 flex h-12 w-12 sm:h-14 sm:w-14 items-center justify-center rounded-2xl bg-[var(--hub-red)] shadow-lg shadow-red-900/30"
          whileHover={{ scale: 1.05 }}
        >
          <span className="text-xl sm:text-2xl font-black text-white">H</span>
        </motion.div>
      )}
      {resolvedTenant ? (
        <h1 className="mt-1 text-lg sm:text-xl font-black text-white">
          {resolvedTenant.name}
        </h1>
      ) : (
        <h1 className="mt-1 text-lg sm:text-xl font-black text-white">The Hub</h1>
      )}

      {/* Step label */}
      <div className="mt-3 sm:mt-4 w-full">
        <AnimatePresence mode="wait">
          <motion.div
            key={`${cardState}-${authMode}`}
            initial={{ opacity: 0, x: 16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.18 }}
            className="text-center"
          >
            <p className="text-sm font-semibold text-white/70">
              {cardState === "userId" ? "Enter your User ID" : cardState === "pattern" ? "Draw your pattern" : "Enter your PIN"}
            </p>
            {(cardState === "pin" || cardState === "pattern") && validatedUser && (
              <div className="mt-1.5 flex items-center justify-center gap-1.5">
                {validatedUser.userType === "location"
                  ? <Store className="h-3.5 w-3.5 text-white/40" />
                  : <Users className="h-3.5 w-3.5 text-white/40" />
                }
                <span className="text-xs font-semibold text-white/80">{validatedUser.name}</span>
                {validatedUser.storeNumber && (
                  <span className="text-[10px] text-white/40">#{validatedUser.storeNumber}</span>
                )}
              </div>
            )}
            {cardState === "userId" && (
              <p className="mt-1 text-xs text-white/40">4-digit User ID</p>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Toggle tabs: PIN | Pattern */}
        {(cardState === "pin" || cardState === "pattern") && validatedUser?.hasPattern && (
          <div className="mt-3 flex items-center justify-center gap-1">
            <button
              onClick={onSwitchToPin}
              className={`rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                authMode === "pin"
                  ? "bg-[var(--hub-red)] text-white shadow-sm"
                  : "bg-white/10 text-white/50 hover:bg-white/20"
              }`}
            >
              PIN
            </button>
            <button
              onClick={onSwitchToPattern}
              className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition-colors ${
                authMode === "pattern"
                  ? "bg-[var(--hub-red)] text-white shadow-sm"
                  : "bg-white/10 text-white/50 hover:bg-white/20"
              }`}
            >
              <Star className="h-3 w-3" />
              Pattern
            </button>
          </div>
        )}

        {/* Constellation Grid (pattern mode) */}
        {cardState === "pattern" && (
          <div className="mt-4 flex flex-col items-center">
            <ConstellationGrid
              onSubmit={onPatternSubmit}
              error={patternError}
              disabled={loading}
            />
          </div>
        )}

        {/* Progress bar for PIN/userId — replaces dots */}
        {cardState !== "pattern" && (
          <motion.div
            key={shakeKey}
            className="mt-4"
            animate={shakeKey > 0 ? { x: [0, -10, 10, -8, 8, -4, 4, 0] } : {}}
            transition={{ duration: 0.45, ease: "easeInOut" }}
          >
            <PinProgressBar filled={currentValue.length} total={maxLength} />
          </motion.div>
        )}

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
                className="flex w-full items-center gap-2 rounded-xl bg-red-500/20 px-3 py-2 text-xs text-red-300"
              >
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                <span>{error}</span>
              </motion.div>
            ) : null}
          </AnimatePresence>
        </div>
      </div>

      {/* PinPad — hidden in pattern mode */}
      {cardState !== "pattern" && (
        <div className="grid w-full grid-cols-3 gap-2 sm:gap-3 mt-1">
          {padButtons.map((btn) => {
            if (btn === "action") {
              if (cardState === "pin") {
                return (
                  <motion.button
                    key="back"
                    whileTap={{ scale: 0.92 }}
                    onClick={onClearOrBack}
                    disabled={loading || validating}
                    className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/10 text-white/60 shadow-sm transition-colors hover:bg-white/15 active:bg-white/20 disabled:opacity-50"
                  >
                    <ChevronLeft className="h-5 w-5" />
                  </motion.button>
                );
              }
              return (
                <motion.button
                  key="clear"
                  whileTap={{ scale: 0.92 }}
                  onClick={onClearOrBack}
                  disabled={loading || validating}
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/5 text-sm font-semibold text-white/50 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
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
                  onClick={onDelete}
                  disabled={loading || validating}
                  className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/5 text-white/50 shadow-sm backdrop-blur-sm transition-colors hover:bg-white/10 active:bg-white/15 disabled:opacity-50"
                >
                  <Delete className="h-5 w-5" />
                </motion.button>
              );
            }
            const isLastDigit =
              (cardState === "userId" && userId.length === maxLength - 1) ||
              (cardState === "pin" && pin.length === maxLength);
            const showSpinner = (validating && cardState === "userId" && userId.length === maxLength) ||
              (loading && cardState === "pin" && pin.length === maxLength);
            return (
              <motion.button
                key={btn}
                whileTap={{ scale: 0.92 }}
                onClick={() => onDigit(btn)}
                disabled={loading || validating}
                {...(isLastDigit && cardState === "pin" && { "data-login-button": true })}
                className="flex h-12 sm:h-16 items-center justify-center rounded-2xl bg-white/10 text-xl font-semibold text-white shadow-sm transition-colors hover:bg-white/15 active:bg-white/20 disabled:opacity-50"
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
      )}

      {/* Back button for pattern mode */}
      {cardState === "pattern" && (
        <div className="mt-2 flex justify-center">
          <motion.button
            whileTap={{ scale: 0.95 }}
            onClick={onGoBackToUserId}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white/60 transition-colors hover:bg-white/15 disabled:opacity-50"
          >
            <ChevronLeft className="h-4 w-4" />
            Back
          </motion.button>
        </div>
      )}

      {/* Loading state below pad */}
      <div className="mt-3 h-6 flex items-center justify-center">
        {(loading || validating) && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex items-center gap-2 text-xs text-white/40"
          >
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            {validating ? "Checking User ID..." : "Signing in..."}
          </motion.div>
        )}
      </div>

      {/* Change Organization link */}
      {resolvedTenant && (
        <button
          onClick={onChangeOrg}
          className="mt-2 text-xs text-white/30 hover:text-white/50 transition-colors"
        >
          Not {resolvedTenant.name}?{" "}
          <span className="underline">Change organization</span>
        </button>
      )}
    </motion.div>
  );
}

// ── Main Login Page ─────────────────────────────────────────────

export default function LoginPage() {
  const { login } = useAuth();
  const meshSupported = useMeshGradientSupport();

  // Card state machine: org → userId → pin/pattern
  const [cardState, setCardState] = useState<CardState>("userId");
  const [userId, setUserId] = useState("");
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [validating, setValidating] = useState(false);
  const [validatedUser, setValidatedUser] = useState<ValidatedUser | null>(null);
  const [isOnline] = useState(true);
  const [authMode, setAuthMode] = useState<AuthMode>("pin");
  const [patternError, setPatternError] = useState(false);

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

  // Apply tenant branding
  const applyBranding = useCallback((tenant: ResolvedTenant) => {
    const root = document.documentElement;
    const color = tenant.primaryColor || "#dc2626";
    root.style.setProperty("--hub-red", color);
    root.style.setProperty("--primary", color);
    root.style.setProperty("--ring", color);
    if (tenant.appTitle) document.title = tenant.appTitle;
    if (tenant.faviconUrl) {
      let link = document.querySelector("link[rel~='icon']") as HTMLLinkElement | null;
      if (!link) { link = document.createElement("link"); link.rel = "icon"; document.head.appendChild(link); }
      link.href = tenant.faviconUrl;
    }
  }, []);

  // Check IP association first, then localStorage for persisted org on mount
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const ipRes = await fetch("/api/auth/resolve-org-by-ip");
        if (!cancelled && ipRes.ok) {
          const ipData = await ipRes.json();
          if (ipData.ok && ipData.tenant) {
            const tenant = ipData.tenant as ResolvedTenant;
            setOrgSlug(tenant.slug);
            setResolvedTenant(tenant);
            applyBranding(tenant);
            localStorage.setItem("hub-org-id", tenant.slug);
            document.cookie = `x-org-id=${tenant.slug}; path=/; max-age=${60 * 60 * 24 * 365}; SameSite=Strict`;
            setOrgChecked(true);
            return;
          }
        }
      } catch { /* fall through */ }
      if (cancelled) return;
      const storedSlug = localStorage.getItem("hub-org-id");
      if (!storedSlug) { setOrgChecked(true); return; }
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
          localStorage.removeItem("hub-org-id");
          document.cookie = "x-org-id=; path=/; max-age=0";
        }
      } catch {
        localStorage.removeItem("hub-org-id");
        document.cookie = "x-org-id=; path=/; max-age=0";
      } finally {
        if (!cancelled) setOrgChecked(true);
      }
    })();
    return () => { cancelled = true; };
  }, [applyBranding]);

  // Submit org ID
  const handleOrgSubmit = useCallback(async () => {
    const trimmed = orgInput.trim();
    if (trimmed.length < 2) { setOrgError("Organization ID must be at least 2 characters"); return; }
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
        setCardState("userId");
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
      if (pendingId) {
        fetch("/api/session/pending", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: pendingId }),
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
  }, [pendingId]);

  useEffect(() => { generateSession(); }, [generateSession]);

  // Instant remote activation via WebSocket
  const { socket } = useSocket();
  useEffect(() => {
    if (!socket || !pendingId) return;
    const handleActivated = async (data: { pendingId: string }) => {
      if (data.pendingId === pendingId) {
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
    return () => { socket.off("session:activated", handleActivated); socket.off("session:ping", handlePing); };
  }, [socket, pendingId]);

  const maxLength = 4;

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (document.activeElement !== keyboardInputRef.current) return;
      const key = e.key;
      if (key >= "0" && key <= "9") { e.preventDefault(); handleDigit(key); }
      else if (key === "Backspace") { e.preventDefault(); handleDelete(); }
      else if (key === "Enter") {
        e.preventDefault();
        if (cardState === "pin" && pin.length === maxLength) {
          const loginButton = document.querySelector("[data-login-button]") as HTMLButtonElement;
          if (loginButton) loginButton.click();
        }
      }
      else if (key === "Escape" && cardState === "pin") { e.preventDefault(); goBackToUserId(); }
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [cardState, userId, pin, maxLength]);

  const goBackToUserId = () => {
    setCardState("userId");
    setValidatedUser(null);
    setAuthMode("pin");
    pinRef.current = "";
    setPin("");
    setError("");
    setPatternError(false);
  };

  const handleDigit = async (digit: string) => {
    setError("");
    if (cardState === "userId") {
      if (userIdRef.current.length < maxLength) {
        const newVal = userIdRef.current + digit;
        userIdRef.current = newVal;
        setUserId(newVal);
        // Haptic feedback per digit
        if (navigator.vibrate) navigator.vibrate(10);
        if (newVal.length === maxLength) {
          setValidating(true);
          try {
            const res = await fetch("/api/auth/validate-user", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ userId: newVal }),
            });
            const data = await res.json();
            if (res.ok && data.found) {
              const user: ValidatedUser = { ...data, hasPattern: !!data.hasPattern };
              setValidatedUser(user);
              setError("");
              const hasPatternHash = !!data.hasPattern;
              if (hasPatternHash) {
                setAuthMode("pin");
                setCardState("pin");
              } else {
                setAuthMode("pin");
                setCardState("pin");
              }
            } else {
              setError(data.error?.message || data.error || "User ID not found");
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
        // Haptic feedback per digit
        if (navigator.vibrate) navigator.vibrate(10);
        if (newVal.length === maxLength) {
          handleLogin(userIdRef.current, newVal);
        }
      }
    }
  };

  const handleDelete = () => {
    setError("");
    if (cardState === "userId") {
      userIdRef.current = userIdRef.current.slice(0, -1);
      setUserId(userIdRef.current);
    } else {
      pinRef.current = pinRef.current.slice(0, -1);
      setPin(pinRef.current);
    }
  };

  const handleClearOrBack = () => {
    setError("");
    if (cardState === "userId") {
      userIdRef.current = "";
      setUserId("");
    } else {
      goBackToUserId();
    }
  };

  const handleLogin = async (uid: string, p: string) => {
    setLoading(true);
    setError("");
    const result = await login(uid, p, orgSlug || undefined);
    if (result.success) {
      if (result.userType === "location") window.location.href = "/dashboard";
      else window.location.href = "/arl";
    } else {
      setError(result.error || "Incorrect PIN. Please try again.");
      setShakeKey((k) => k + 1);
      pinRef.current = "";
      setPin("");
      setLoading(false);
    }
  };

  const handlePatternSubmit = async (pattern: number[]) => {
    setLoading(true);
    setError("");
    setPatternError(false);
    const result = await login(userIdRef.current, "", orgSlug || undefined, pattern);
    if (result.success) {
      if (result.userType === "location") window.location.href = "/dashboard";
      else window.location.href = "/arl";
    } else {
      setError(result.error || "Incorrect pattern. Please try again.");
      setPatternError(true);
      setShakeKey((k) => k + 1);
      setLoading(false);
    }
  };

  const handleChangeOrg = () => {
    document.cookie = "x-org-id=; path=/; max-age=0";
    localStorage.removeItem("hub-org-id");
    setOrgSlug(null);
    setResolvedTenant(null);
    setCardState("org");
    setValidatedUser(null);
    userIdRef.current = "";
    setUserId("");
    pinRef.current = "";
    setPin("");
    setError("");
  };

  // Determine effective card state: if no org resolved, show org entry
  const effectiveCardState: CardState = (!orgChecked || (!orgSlug && orgChecked)) ? "org" : cardState;

  // Loading state — waiting for org check
  if (!orgChecked) {
    return (
      <div className="min-h-screen min-h-dvh w-screen flex items-center justify-center" style={{ background: "hsl(var(--bg-base-h), var(--bg-base-s), var(--bg-base-l))" }}>
        <style dangerouslySetInnerHTML={{ __html: MESH_GRADIENT_STYLES }} />
        <Loader2 className="h-8 w-8 animate-spin text-[var(--hub-red)]" />
      </div>
    );
  }

  return (
    <div className={`min-h-screen min-h-dvh w-screen overflow-y-auto flex flex-col items-center py-6 px-4 ${
      meshSupported ? "mesh-gradient-bg" : "mesh-gradient-fallback"
    } ${effectiveCardState === "org" && showOrgKeyboard ? "max-sm:justify-start max-sm:pt-12" : ""}`}>
      <style dangerouslySetInnerHTML={{ __html: MESH_GRADIENT_STYLES }} />

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
              <div className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--hub-red)] shadow-2xl shadow-red-900/50">
                <span className="text-4xl">👋</span>
              </div>
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="rounded-2xl bg-white/10 backdrop-blur-xl border border-white/10 px-6 py-3 shadow-xl text-center"
              >
                <p className="text-lg font-black text-white">Hey, that&apos;s you!</p>
                <p className="text-sm text-white/60">Your ARL is confirming your session</p>
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm"
          >
            <div className="text-center">
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[var(--hub-red)]" />
              <p className="mt-3 text-sm font-semibold text-white">Logging you in remotely...</p>
              <p className="text-xs text-white/40">Please wait</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Spacer for keyboard on mobile */}
      {effectiveCardState === "org" && showOrgKeyboard && <div className="flex-1 min-h-4 sm:hidden" />}

      {/* ── Morphing Card ── */}
      <motion.div
        layout
        layoutId="login-card"
        className="w-full max-w-sm my-auto rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-lg px-5 py-6 sm:px-8 sm:py-8 flex flex-col items-center"
        transition={{ layout: { type: "spring", stiffness: 200, damping: 25 } }}
      >
        <AnimatePresence mode="wait">
          {effectiveCardState === "org" ? (
            <OrgContent
              key="org"
              orgInput={orgInput}
              orgError={orgError}
              orgLoading={orgLoading}
              showOrgKeyboard={showOrgKeyboard}
              onOrgInputChange={setOrgInput}
              onOrgSubmit={handleOrgSubmit}
              onToggleKeyboard={() => setShowOrgKeyboard((v) => !v)}
              orgInputRef={orgInputRef}
            />
          ) : (
            <AuthContent
              key={`auth-${cardState}`}
              cardState={cardState}
              userId={userId}
              pin={pin}
              error={error}
              loading={loading}
              validating={validating}
              validatedUser={validatedUser}
              authMode={authMode}
              patternError={patternError}
              shakeKey={shakeKey}
              resolvedTenant={resolvedTenant}
              onDigit={handleDigit}
              onDelete={handleDelete}
              onClearOrBack={handleClearOrBack}
              onPatternSubmit={handlePatternSubmit}
              onGoBackToUserId={goBackToUserId}
              onSwitchToPin={() => { setAuthMode("pin"); setCardState("pin"); setError(""); setPatternError(false); pinRef.current = ""; setPin(""); }}
              onSwitchToPattern={() => { setAuthMode("pattern"); setCardState("pattern"); setError(""); pinRef.current = ""; setPin(""); }}
              onChangeOrg={handleChangeOrg}
              keyboardInputRef={keyboardInputRef}
            />
          )}
        </AnimatePresence>

        {/* Session code footer strip — integrated at bottom of card */}
        <SessionCodeFooter
          pendingCode={pendingCode}
          selfPinged={selfPinged}
          onSelfPing={handleSelfPing}
          onRefresh={generateSession}
          refreshing={refreshing}
          isOnline={isOnline}
        />
      </motion.div>

      {/* Virtual keyboard for org entry */}
      {effectiveCardState === "org" && showOrgKeyboard && (
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
          <div className="h-[320px] sm:h-0 shrink-0" />
        </>
      )}
    </div>
  );
}
