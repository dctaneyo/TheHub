"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { WarRoomMap } from "@/components/arl/war-room-map";
import { WarRoomSummary, type WarRoomLocation } from "@/components/arl/war-room-summary";
import { Loader2 } from "@/lib/icons";

export default function WarRoomPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [locations, setLocations] = useState<WarRoomLocation[]>([]);
  const [loading, setLoading] = useState(true);

  // Auth guard: ARL only
  useEffect(() => {
    if (!authLoading && (!user || user.userType !== "arl")) {
      router.replace("/login");
    }
  }, [user, authLoading, router]);

  // Fetch war room status
  useEffect(() => {
    if (!user || user.userType !== "arl") return;
    let cancelled = false;

    async function fetchStatus() {
      try {
        const res = await fetch("/api/arl/war-room/status");
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled && data.ok) {
          setLocations(data.locations);
        }
      } catch {
        // silently fail
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchStatus();
    // Refresh every 60s
    const interval = setInterval(fetchStatus, 60000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [user]);

  const handleLocationsUpdate = useCallback(
    (updater: (prev: WarRoomLocation[]) => WarRoomLocation[]) => {
      setLocations(updater);
    },
    []
  );

  if (authLoading || (!user || user.userType !== "arl")) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Summary bar */}
      <div className="absolute top-4 left-1/2 z-20 -translate-x-1/2">
        <WarRoomSummary locations={locations} />
      </div>

      {/* Map */}
      <WarRoomMap locations={locations} onLocationsUpdate={handleLocationsUpdate} />
    </div>
  );
}
