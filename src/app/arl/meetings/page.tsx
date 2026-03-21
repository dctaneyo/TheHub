"use client";

import { useState } from "react";
import { Video, Radio } from "@/lib/icons";
import { ScheduledMeetings } from "@/components/arl/scheduled-meetings";
import { MeetingAnalyticsDashboard } from "@/components/arl/meeting-analytics";
import { BroadcastLauncher } from "@/components/arl/broadcast-launcher";
import { useArlDashboard } from "@/lib/arl-dashboard-context";

export default function MeetingsPage() {
  const { activeMeetings, setJoiningMeeting, navigateToView } = useArlDashboard();
  const [showBroadcastLauncher, setShowBroadcastLauncher] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <div className="space-y-6">
        {/* Go Live broadcast button */}
        <button
          onClick={() => setShowBroadcastLauncher(true)}
          className="w-full bg-gradient-to-r from-red-600 to-orange-600 hover:from-red-700 hover:to-orange-700 text-white rounded-2xl p-5 flex items-center gap-4 transition-all shadow-lg shadow-red-200/30 dark:shadow-red-900/20"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
            <Radio className="h-6 w-6" />
          </div>
          <div className="text-left flex-1">
            <p className="text-base font-bold">Go Live</p>
            <p className="text-sm text-white/80">Broadcast to all online locations</p>
          </div>
          <div className="h-3 w-3 rounded-full bg-white animate-pulse" />
        </button>

        {activeMeetings.length > 0 && (
          <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
            <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
              <div className="h-2.5 w-2.5 rounded-full bg-green-500 animate-pulse" />
              Active Meetings
            </h2>
            <div className="space-y-3">
              {activeMeetings.map((meeting) => (
                <div
                  key={meeting.meetingId}
                  className="bg-card border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between hover:border-emerald-500/30 transition-colors shadow-sm"
                >
                  <div>
                    <h3 className="text-foreground font-semibold">{meeting.title}</h3>
                    <p className="text-muted-foreground text-sm">Host: {meeting.hostName}</p>
                  </div>
                  <button
                    onClick={() => setJoiningMeeting({ meetingId: meeting.meetingId, title: meeting.title })}
                    className="bg-[var(--hub-red)] hover:bg-red-700 text-white font-semibold px-6 py-2.5 rounded-xl transition-colors flex items-center gap-2 shadow-sm"
                  >
                    <Video className="h-4 w-4" />
                    Join
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
        <ScheduledMeetings onStartOnDemand={() => navigateToView("broadcast")} />
        <div className="border-t border-border pt-6">
          <MeetingAnalyticsDashboard />
        </div>
      </div>

      {/* Broadcast launcher modal */}
      <BroadcastLauncher
        isOpen={showBroadcastLauncher}
        onClose={() => setShowBroadcastLauncher(false)}
      />
    </div>
  );
}
