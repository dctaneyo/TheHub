"use client";

import { useState } from "react";
import { Video, Radio } from "@/lib/icons";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { ScheduledMeetings } from "@/components/arl/scheduled-meetings";
import { MeetingAnalyticsDashboard } from "@/components/arl/meeting-analytics";
import { BroadcastLauncher } from "@/components/arl/broadcast-launcher";
import { useArlDashboard } from "@/lib/arl-dashboard-context";

/**
 * Tabbed so a visit here to join/schedule a meeting — the primary reason
 * to be on this page — doesn't require scrolling past a full analytics
 * dashboard first. Meetings is the default tab; Analytics is one explicit
 * tap away, not a continuation of the same scroll (Section 12).
 */
export default function MeetingsPage() {
  const { activeMeetings, setJoiningMeeting, navigateToView } = useArlDashboard();
  const [showBroadcastLauncher, setShowBroadcastLauncher] = useState(false);

  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <Tabs defaultValue="meetings">
        <TabsList>
          <TabsTrigger value="meetings">Meetings</TabsTrigger>
          <TabsTrigger value="analytics">Analytics</TabsTrigger>
        </TabsList>

        <TabsContent value="meetings" className="space-y-6">
          {/* Go Live broadcast button */}
          <button
            onClick={() => setShowBroadcastLauncher(true)}
            className="w-full bg-gradient-to-r from-red-600 to-red-700 active:from-red-700 active:to-red-800 text-white rounded-2xl p-5 flex items-center gap-4 transition-all"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/20">
              <Radio className="h-6 w-6" />
            </div>
            <div className="text-left flex-1">
              <p className="text-lg font-semibold">Go Live</p>
              <p className="text-sm text-white/80">Broadcast to all online locations</p>
            </div>
          </button>

          {activeMeetings.length > 0 && (
            <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground mb-4">
                Active Meetings
              </h2>
              <div className="space-y-3">
                {activeMeetings.map((meeting) => (
                  <div
                    key={meeting.meetingId}
                    className="bg-card border border-emerald-500/20 rounded-xl p-4 flex items-center justify-between active:border-emerald-500/30 transition-colors"
                  >
                    <div>
                      <h3 className="text-foreground font-semibold">{meeting.title}</h3>
                      <p className="text-muted-foreground text-sm">Host: {meeting.hostName}</p>
                    </div>
                    <button
                      onClick={() => setJoiningMeeting({ meetingId: meeting.meetingId, title: meeting.title })}
                      className="bg-[var(--hub-red)] active:bg-red-700 text-white font-semibold px-6 py-2 rounded-xl transition-colors flex items-center gap-2"
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
        </TabsContent>

        <TabsContent value="analytics">
          <MeetingAnalyticsDashboard />
        </TabsContent>
      </Tabs>

      {/* Broadcast launcher modal */}
      <BroadcastLauncher
        isOpen={showBroadcastLauncher}
        onClose={() => setShowBroadcastLauncher(false)}
      />
    </div>
  );
}
