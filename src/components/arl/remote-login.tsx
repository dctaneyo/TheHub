"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Monitor, Store, Users, CheckCircle2, Loader2, RefreshCw, Zap, LogOut, ArrowRightLeft, Wifi, AlertTriangle, Bell, Hand } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDistanceToNow } from "date-fns";
import { useSocket } from "@/lib/socket-context";

interface PendingSession {
  id: string;
  code: string;
  userAgent: string;
  createdAt: string;
  expiresAt: string;
}

interface ActiveSession {
  id: string;
  sessionCode: string | null;
  userType: string;
  userId: string;
  name: string;
  storeNumber: string | null;
  deviceType: string | null;
  lastSeen: string;
  createdAt: string;
}

interface Location {
  id: string;
  name: string;
  storeNumber: string;
}

interface ArlUser {
  id: string;
  name: string;
  role: string;
}

export function RemoteLogin() {
  const [pendingSessions, setPendingSessions] = useState<PendingSession[]>([]);
  const [activeSessions, setActiveSessions] = useState<ActiveSession[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [arls, setArls] = useState<ArlUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<PendingSession | null>(null);
  const [assignType, setAssignType] = useState<"location" | "arl">("location");
  const [activating, setActivating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  // Force session management
  const [forceTarget, setForceTarget] = useState<ActiveSession | null>(null);
  const [forceAction, setForceAction] = useState<"reassign" | "logout" | null>(null);
  const [forceAssignType, setForceAssignType] = useState<"location" | "arl">("location");
  const [forcing, setForcing] = useState(false);
  const [pingingId, setPingingId] = useState<string | null>(null);
  const [selfPingingId, setSelfPingingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, locRes, arlRes, activeRes] = await Promise.all([
        fetch("/api/session/pending"),
        fetch("/api/locations"),
        fetch("/api/arls"),
        fetch("/api/session/force"),
      ]);
      if (sessRes.ok) {
        const d = await sessRes.json();
        setPendingSessions(d.pendingSessions || []);
      }
      if (locRes.ok) {
        const d = await locRes.json();
        setLocations(d.locations || []);
      }
      if (arlRes.ok) {
        const d = await arlRes.json();
        setArls(d.arls || []);
      }
      if (activeRes.ok) {
        const d = await activeRes.json();
        setActiveSessions(d.activeSessions || []);
      }
    } catch {}
    setLoading(false);
  }, []);

  const { socket } = useSocket();

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Instant updates via WebSocket
  useEffect(() => {
    if (!socket) return;
    const handler = () => fetchData();
    socket.on("session:pending", handler);
    socket.on("session:pending:refresh", handler);
    return () => {
      socket.off("session:pending", handler);
      socket.off("session:pending:refresh", handler);
    };
  }, [socket, fetchData]);

  // Self-ping: device tapped their session ID — highlight it here
  useEffect(() => {
    if (!socket) return;
    const handler = (data: { pendingId: string; code: string }) => {
      setSelfPingingId(data.pendingId);
      setTimeout(() => setSelfPingingId(null), 3000);
    };
    socket.on("session:self-ping", handler);
    return () => { socket.off("session:self-ping", handler); };
  }, [socket]);

  const handleActivate = async (assignToId: string) => {
    if (!selectedSession) return;
    setActivating(true);
    setErrorMsg("");
    setSuccessMsg("");

    try {
      const res = await fetch("/api/session/activate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pendingId: selectedSession.id,
          assignToType: assignType,
          assignToId,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        setSuccessMsg(`Logged in ${data.targetName} successfully! Redirecting to ${data.redirectTo}`);
        setSelectedSession(null);
        setTimeout(() => setSuccessMsg(""), 5000);
        fetchData();
      } else {
        const data = await res.json();
        setErrorMsg(data.error || "Failed to activate session");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    }
    setActivating(false);
  };

  const handlePing = async (pendingId: string) => {
    setPingingId(pendingId);
    try {
      await fetch("/api/session/ping", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pendingId }),
      });
    } catch {}
    setTimeout(() => setPingingId(null), 2000);
  };

  const handleForceLogout = async (sess: ActiveSession) => {
    setForcing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/session/force", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "logout", sessionId: sess.id }),
      });
      if (res.ok) {
        setSuccessMsg(`Force logged out ${sess.name} successfully`);
        setForceTarget(null);
        setForceAction(null);
        setTimeout(() => setSuccessMsg(""), 5000);
        fetchData();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to force logout");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    }
    setForcing(false);
  };

  const handleForceReassign = async (assignToId: string) => {
    if (!forceTarget) return;
    setForcing(true);
    setErrorMsg("");
    setSuccessMsg("");
    try {
      const res = await fetch("/api/session/force", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "reassign",
          sessionId: forceTarget.id,
          assignToType: forceAssignType,
          assignToId,
        }),
      });
      if (res.ok) {
        const d = await res.json();
        setSuccessMsg(`Reassigned to ${d.targetName} → ${d.redirectTo}`);
        setForceTarget(null);
        setForceAction(null);
        setTimeout(() => setSuccessMsg(""), 5000);
        fetchData();
      } else {
        const d = await res.json();
        setErrorMsg(d.error || "Failed to reassign session");
      }
    } catch {
      setErrorMsg("Network error. Please try again.");
    }
    setForcing(false);
  };

  const getDeviceHint = (ua: string) => {
    if (/mobile/i.test(ua)) return "Mobile";
    if (/tablet|ipad/i.test(ua)) return "Tablet";
    if (/kiosk/i.test(ua)) return "Kiosk";
    return "Desktop/Kiosk";
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-200 border-t-[var(--hub-red)]" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-slate-800">Remote Login</h2>
          <p className="text-xs text-slate-400">
            Log in devices remotely using their Session ID from the login screen
          </p>
        </div>
        <button
          onClick={fetchData}
          className="flex items-center gap-1.5 rounded-xl bg-slate-100 px-3 py-2 text-xs font-medium text-slate-600 hover:bg-slate-200"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </button>
      </div>

      {/* Success/error messages */}
      {successMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-emerald-50 border border-emerald-200 px-4 py-3">
          <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
          <span className="text-sm font-medium text-emerald-700">{successMsg}</span>
        </div>
      )}
      {errorMsg && (
        <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-200 px-4 py-3">
          <span className="text-sm font-medium text-red-700">{errorMsg}</span>
        </div>
      )}

      {/* Pending sessions */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">
          Waiting Sessions
          {pendingSessions.length > 0 && (
            <span className="ml-2 rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-700">
              {pendingSessions.length}
            </span>
          )}
        </h3>

        {pendingSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-12 text-center">
            <Monitor className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No devices waiting to be logged in</p>
            <p className="text-xs text-slate-300">Devices show a Session ID on the login screen</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {pendingSessions.map((ps) => {
              const isSelected = selectedSession?.id === ps.id;
              const isSelfPinging = selfPingingId === ps.id;
              return (
                <div key={ps.id} className="relative">
                  {/* Radiating rings when device self-pings */}
                  <AnimatePresence>
                    {isSelfPinging && [0, 1, 2].map((i) => (
                      <motion.div
                        key={i}
                        className="absolute inset-0 rounded-2xl border-2 border-amber-400 pointer-events-none"
                        initial={{ opacity: 0.8, scale: 1 }}
                        animate={{ opacity: 0, scale: 1.18 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.9, delay: i * 0.28, ease: "easeOut" }}
                      />
                    ))}
                  </AnimatePresence>

                  <div className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all",
                    isSelfPinging
                      ? "border-amber-400 bg-amber-50 ring-2 ring-amber-300/40 shadow-lg shadow-amber-100"
                      : isSelected
                      ? "border-[var(--hub-red)] bg-red-50/50 ring-2 ring-[var(--hub-red)]/20 shadow-md"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  )}>
                    {/* "That's me!" badge */}
                    <AnimatePresence>
                      {isSelfPinging && (
                        <motion.div
                          initial={{ opacity: 0, y: -8, scale: 0.8 }}
                          animate={{ opacity: 1, y: 0, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ type: "spring", stiffness: 400, damping: 20 }}
                          className="flex items-center gap-1.5 rounded-full bg-amber-400 px-3 py-1 text-[11px] font-black text-white shadow-md"
                        >
                          <Hand className="h-3 w-3" />
                          That&apos;s me!
                        </motion.div>
                      )}
                    </AnimatePresence>

                    <button
                      onClick={() => setSelectedSession(isSelected ? null : ps)}
                      className="flex flex-col items-center gap-2 w-full"
                    >
                      <Monitor className={cn("h-6 w-6", isSelfPinging ? "text-amber-500" : isSelected ? "text-[var(--hub-red)]" : "text-slate-400")} />
                      <span className={cn("text-2xl font-black tracking-[0.2em]", isSelfPinging ? "text-amber-700" : "text-slate-800")}>{ps.code}</span>
                      <div className="text-[10px] text-slate-400">
                        <p>{getDeviceHint(ps.userAgent)}</p>
                        <p>{formatDistanceToNow(new Date(ps.createdAt), { addSuffix: true })}</p>
                      </div>
                    </button>
                    <button
                      onClick={() => handlePing(ps.id)}
                      disabled={pingingId === ps.id}
                      className={cn(
                        "flex items-center gap-1.5 rounded-xl px-3 py-1.5 text-[11px] font-semibold transition-all",
                        pingingId === ps.id
                          ? "bg-amber-400 text-white scale-95"
                          : "bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700"
                      )}
                      title="Send a visual ping to this device to confirm it's the right one"
                    >
                      <Bell className={cn("h-3 w-3", pingingId === ps.id && "animate-bounce")} />
                      {pingingId === ps.id ? "Pinged!" : "Ping"}
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Assignment panel (shown when a session is selected) */}
      {selectedSession && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-4 flex items-center gap-3">
            <Zap className="h-5 w-5 text-[var(--hub-red)]" />
            <div>
              <h3 className="text-sm font-bold text-slate-800">
                Assign Session <span className="font-black tracking-widest">{selectedSession.code}</span>
              </h3>
              <p className="text-xs text-slate-400">Choose an account to log this device into</p>
            </div>
          </div>

          {/* Type tabs */}
          <div className="mb-4 flex gap-1 rounded-xl bg-slate-100 p-1">
            <button
              onClick={() => setAssignType("location")}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                assignType === "location"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Store className="mr-1.5 inline h-3.5 w-3.5" />
              Location
            </button>
            <button
              onClick={() => setAssignType("arl")}
              className={cn(
                "flex-1 rounded-lg py-2 text-xs font-semibold transition-colors",
                assignType === "arl"
                  ? "bg-white text-slate-800 shadow-sm"
                  : "text-slate-500 hover:text-slate-700"
              )}
            >
              <Users className="mr-1.5 inline h-3.5 w-3.5" />
              ARL
            </button>
          </div>

          {/* Account list */}
          <div className="max-h-64 space-y-1.5 overflow-y-auto">
            {assignType === "location" ? (
              locations.map((loc) => (
                <button
                  key={loc.id}
                  onClick={() => handleActivate(loc.id)}
                  disabled={activating}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Store className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{loc.name}</p>
                    <p className="text-[10px] text-slate-400">Store #{loc.storeNumber}</p>
                  </div>
                  <span className="text-[10px] font-bold text-[var(--hub-red)]">→ Dashboard</span>
                </button>
              ))
            ) : (
              arls.map((arl) => (
                <button
                  key={arl.id}
                  onClick={() => handleActivate(arl.id)}
                  disabled={activating}
                  className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-purple-100 text-purple-600">
                    <Users className="h-4 w-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-800">{arl.name}</p>
                    <p className="text-[10px] text-slate-400">{arl.role === "admin" ? "Admin" : "ARL"}</p>
                  </div>
                  <span className="text-[10px] font-bold text-purple-600">→ ARL Hub</span>
                </button>
              ))
            )}
          </div>

          {activating && (
            <div className="mt-3 flex items-center justify-center gap-2 text-xs text-slate-400">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              Activating session...
            </div>
          )}
        </div>
      )}

      {/* Active Sessions — Force Management */}
      <div>
        <h3 className="mb-3 text-sm font-bold text-slate-700">
          Active Sessions
          {activeSessions.length > 0 && (
            <span className="ml-2 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
              {activeSessions.length}
            </span>
          )}
        </h3>

        {activeSessions.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 py-8 text-center">
            <Wifi className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-sm text-slate-400">No active sessions</p>
          </div>
        ) : (
          <div className="space-y-2">
            {activeSessions.map((sess) => {
              const isForceTarget = forceTarget?.id === sess.id;
              return (
                <div key={sess.id}>
                  <div
                    className={cn(
                      "flex items-center gap-3 rounded-2xl border p-4 transition-all",
                      isForceTarget
                        ? "border-amber-300 bg-amber-50/50 ring-2 ring-amber-200/50"
                        : "border-slate-200 bg-white"
                    )}
                  >
                    <div className={cn(
                      "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl",
                      sess.userType === "location" ? "bg-emerald-100 text-emerald-600" : "bg-purple-100 text-purple-600"
                    )}>
                      {sess.userType === "location" ? <Store className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-800">{sess.name}</p>
                      <p className="text-[10px] text-slate-400">
                        {sess.userType === "location" ? `Store #${sess.storeNumber}` : "ARL"}
                        {sess.sessionCode && <> · <span className="font-mono font-bold">{sess.sessionCode}</span></>}
                        {sess.deviceType && <> · {sess.deviceType}</>}
                        {" · "}
                        {formatDistanceToNow(new Date(sess.lastSeen), { addSuffix: true })}
                      </p>
                    </div>
                    <div className="flex shrink-0 gap-1.5">
                      <button
                        onClick={() => { setForceTarget(isForceTarget ? null : sess); setForceAction(isForceTarget ? null : "reassign"); }}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                          isForceTarget && forceAction === "reassign"
                            ? "bg-amber-200 text-amber-800"
                            : "bg-slate-100 text-slate-500 hover:bg-amber-100 hover:text-amber-700"
                        )}
                        title="Force reassign to another account"
                      >
                        <ArrowRightLeft className="h-3 w-3" />
                        Reassign
                      </button>
                      <button
                        onClick={() => {
                          if (isForceTarget && forceAction === "logout") {
                            handleForceLogout(sess);
                          } else {
                            setForceTarget(sess);
                            setForceAction("logout");
                          }
                        }}
                        disabled={forcing}
                        className={cn(
                          "flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-[10px] font-semibold transition-colors",
                          isForceTarget && forceAction === "logout"
                            ? "bg-red-500 text-white"
                            : "bg-slate-100 text-slate-500 hover:bg-red-100 hover:text-red-700"
                        )}
                        title={isForceTarget && forceAction === "logout" ? "Click again to confirm" : "Force logout to login screen"}
                      >
                        <LogOut className="h-3 w-3" />
                        {isForceTarget && forceAction === "logout" ? "Confirm" : "Logout"}
                      </button>
                    </div>
                  </div>

                  {/* Force reassign panel */}
                  {isForceTarget && forceAction === "reassign" && (
                    <div className="mt-2 rounded-2xl border border-amber-200 bg-amber-50/30 p-4">
                      <div className="mb-3 flex items-center gap-2">
                        <AlertTriangle className="h-4 w-4 text-amber-600" />
                        <span className="text-xs font-bold text-amber-800">
                          Reassign {sess.name} to a different account
                        </span>
                      </div>

                      {/* Type tabs */}
                      <div className="mb-3 flex gap-1 rounded-xl bg-white p-1">
                        <button
                          onClick={() => setForceAssignType("location")}
                          className={cn(
                            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                            forceAssignType === "location"
                              ? "bg-slate-100 text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          <Store className="mr-1 inline h-3 w-3" />
                          Location
                        </button>
                        <button
                          onClick={() => setForceAssignType("arl")}
                          className={cn(
                            "flex-1 rounded-lg py-1.5 text-xs font-semibold transition-colors",
                            forceAssignType === "arl"
                              ? "bg-slate-100 text-slate-800 shadow-sm"
                              : "text-slate-500 hover:text-slate-700"
                          )}
                        >
                          <Users className="mr-1 inline h-3 w-3" />
                          ARL
                        </button>
                      </div>

                      <div className="max-h-48 space-y-1 overflow-y-auto">
                        {forceAssignType === "location" ? (
                          locations.map((loc) => (
                            <button
                              key={loc.id}
                              onClick={() => handleForceReassign(loc.id)}
                              disabled={forcing}
                              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Store className="h-3.5 w-3.5 text-slate-400" />
                              <span className="flex-1 text-xs font-medium text-slate-700">{loc.name}</span>
                              <span className="text-[10px] text-slate-400">#{loc.storeNumber}</span>
                            </button>
                          ))
                        ) : (
                          arls.map((arl) => (
                            <button
                              key={arl.id}
                              onClick={() => handleForceReassign(arl.id)}
                              disabled={forcing}
                              className="flex w-full items-center gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-left transition-colors hover:bg-slate-50 disabled:opacity-50"
                            >
                              <Users className="h-3.5 w-3.5 text-purple-400" />
                              <span className="flex-1 text-xs font-medium text-slate-700">{arl.name}</span>
                              <span className="text-[10px] text-slate-400">{arl.role === "admin" ? "Admin" : "ARL"}</span>
                            </button>
                          ))
                        )}
                      </div>

                      {forcing && (
                        <div className="mt-2 flex items-center justify-center gap-2 text-xs text-slate-400">
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          Reassigning...
                        </div>
                      )}

                      <button
                        onClick={() => { setForceTarget(null); setForceAction(null); }}
                        className="mt-2 w-full rounded-lg py-1.5 text-[10px] font-medium text-slate-400 hover:bg-white hover:text-slate-600"
                      >
                        Cancel
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* How it works */}
      <div className="rounded-2xl bg-slate-50 p-5">
        <h3 className="mb-2 text-xs font-bold text-slate-500 uppercase tracking-wider">How it works</h3>
        <ol className="space-y-2 text-xs text-slate-500">
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">1</span>
            The device opens the login screen and a <strong>Session ID</strong> appears in the top-right corner
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">2</span>
            The restaurant tells you their Session ID (e.g. over the phone)
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">3</span>
            Find the Session ID here, select it, and choose which location or ARL to log in as
          </li>
          <li className="flex items-start gap-2">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-200 text-[10px] font-bold text-slate-600">4</span>
            The device automatically logs in and redirects to the dashboard or ARL Hub
          </li>
        </ol>
      </div>
    </div>
  );
}
