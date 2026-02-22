"use client";

import { useState, useEffect } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth-context";
import {
  LiveKitRoom,
  VideoConference,
} from "@livekit/components-react";
import "@livekit/components-styles";

interface MeetingRoomLiveKitProps {
  meetingId: string;
  title: string;
  isHost: boolean;
  onLeave: () => void;
}

export function MeetingRoomLiveKit({ meetingId, title, isHost, onLeave }: MeetingRoomLiveKitProps) {
  const { user } = useAuth();
  const [token, setToken] = useState<string>("");
  const [wsUrl, setWsUrl] = useState<string>("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string>("");

  // Fetch LiveKit token on mount
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const res = await fetch("/api/livekit/token", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            roomName: meetingId,
            participantName: user?.name || "Guest",
          }),
        });

        if (!res.ok) {
          throw new Error("Failed to get token");
        }

        const data = await res.json();
        setToken(data.token);
        setWsUrl(data.wsUrl);
      } catch (err) {
        console.error("Token fetch error:", err);
        setError("Failed to join meeting. Please try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchToken();
  }, [meetingId, user?.name]);

  if (loading) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-white animate-spin mx-auto mb-4" />
          <p className="text-white text-lg">Connecting to meeting...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 bg-slate-900 flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-400 text-lg mb-4">{error}</p>
          <Button onClick={onLeave}>Go Back</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 bg-slate-900">
      <LiveKitRoom
        video={isHost || user?.userType === "arl" || user?.userType === "guest"}
        audio={true}
        token={token}
        serverUrl={wsUrl}
        data-lk-theme="default"
        style={{ height: "100vh" }}
        onDisconnected={onLeave}
      >
        {/* LiveKit's built-in VideoConference component with chat, screen share, etc. */}
        <VideoConference />
      </LiveKitRoom>
    </div>
  );
}
