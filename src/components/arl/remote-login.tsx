"use client";

import { useState, useEffect, useCallback } from "react";
import { Monitor, Store, Users, CheckCircle2, Loader2, RefreshCw, Zap } from "lucide-react";
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
  const [locations, setLocations] = useState<Location[]>([]);
  const [arls, setArls] = useState<ArlUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSession, setSelectedSession] = useState<PendingSession | null>(null);
  const [assignType, setAssignType] = useState<"location" | "arl">("location");
  const [activating, setActivating] = useState(false);
  const [successMsg, setSuccessMsg] = useState("");
  const [errorMsg, setErrorMsg] = useState("");

  const fetchData = useCallback(async () => {
    try {
      const [sessRes, locRes, arlRes] = await Promise.all([
        fetch("/api/session/pending"),
        fetch("/api/locations"),
        fetch("/api/arls"),
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
              return (
                <button
                  key={ps.id}
                  onClick={() => setSelectedSession(isSelected ? null : ps)}
                  className={cn(
                    "flex flex-col items-center gap-2 rounded-2xl border p-5 text-center transition-all",
                    isSelected
                      ? "border-[var(--hub-red)] bg-red-50/50 ring-2 ring-[var(--hub-red)]/20 shadow-md"
                      : "border-slate-200 bg-white hover:border-slate-300 hover:shadow-sm"
                  )}
                >
                  <Monitor className={cn("h-6 w-6", isSelected ? "text-[var(--hub-red)]" : "text-slate-400")} />
                  <span className="text-2xl font-black tracking-[0.2em] text-slate-800">{ps.code}</span>
                  <div className="text-[10px] text-slate-400">
                    <p>{getDeviceHint(ps.userAgent)}</p>
                    <p>{formatDistanceToNow(new Date(ps.createdAt), { addSuffix: true })}</p>
                  </div>
                </button>
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
