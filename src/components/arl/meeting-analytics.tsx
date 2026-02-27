"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
  BarChart3, Users, Clock, MessageCircle, Hand, ThumbsUp,
  HelpCircle, TrendingUp, Video, ChevronRight, ChevronLeft,
  Calendar, Loader2, ArrowLeft, Trash2,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface MeetingAnalytics {
  id: string;
  meetingId: string;
  title: string;
  hostId: string;
  hostName: string;
  startedAt: string;
  endedAt: string | null;
  duration: number | null;
  totalParticipants: number;
  totalLocations: number;
  totalArls: number;
  totalGuests: number;
  peakParticipants: number;
  totalMessages: number;
  totalQuestions: number;
  totalReactions: number;
  totalHandRaises: number;
  screenShareDuration: number;
}

interface MeetingParticipant {
  id: string;
  meetingId: string;
  participantId: string;
  participantName: string;
  participantType: string;
  role: string;
  joinedAt: string;
  leftAt: string | null;
  duration: number | null;
  hadVideo: boolean;
  hadAudio: boolean;
  messagesSent: number;
  questionsSent: number;
  reactionsSent: number;
  handRaiseCount: number;
  wasMutedByHost: boolean;
}

interface Summary {
  totalMeetings: number;
  completedMeetings: number;
  totalDuration: number;
  avgDuration: number;
  avgParticipants: number;
  totalMessages: number;
  totalReactions: number;
  totalQuestions: number;
  totalHandRaises: number;
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return "—";
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  if (h > 0) return `${h}h ${m}m`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
    timeZone: "Pacific/Honolulu",
  });
}

export function MeetingAnalyticsDashboard() {
  const [meetings, setMeetings] = useState<MeetingAnalytics[]>([]);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedMeeting, setSelectedMeeting] = useState<string | null>(null);
  const [meetingDetail, setMeetingDetail] = useState<{ meeting: MeetingAnalytics; participants: MeetingParticipant[] } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, []);

  const fetchAnalytics = async () => {
    try {
      const res = await fetch("/api/meetings/analytics");
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMeetings(data.meetings || []);
      setSummary(data.summary || null);
    } catch {
      console.error("Failed to fetch analytics");
    } finally {
      setLoading(false);
    }
  };

  const fetchDetail = async (analyticsId: string) => {
    setDetailLoading(true);
    setSelectedMeeting(analyticsId);
    try {
      const res = await fetch(`/api/meetings/analytics?id=${analyticsId}`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMeetingDetail(data);
    } catch {
      console.error("Failed to fetch meeting detail");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleDeleteAll = async () => {
    setDeleting(true);
    try {
      const res = await fetch("/api/meetings/analytics", {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      // Refresh analytics after deletion
      setMeetings([]);
      setSummary(null);
      setShowDeleteConfirm(false);
      await fetchAnalytics();
    } catch {
      console.error("Failed to delete analytics");
      alert("Failed to delete meeting data. Please try again.");
    } finally {
      setDeleting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Detail view
  if (selectedMeeting && meetingDetail) {
    const { meeting: m, participants } = meetingDetail;
    return (
      <div className="space-y-4">
        <button
          onClick={() => { setSelectedMeeting(null); setMeetingDetail(null); }}
          className="flex items-center gap-2 text-sm text-blue-400 hover:text-blue-300 mb-2"
        >
          <ArrowLeft className="h-4 w-4" /> Back to all meetings
        </button>

        {/* Meeting header */}
        <div className="bg-slate-800 rounded-xl p-4 border border-slate-700">
          <h3 className="text-lg font-bold text-white mb-1">{m.title}</h3>
          <p className="text-sm text-muted-foreground">Hosted by {m.hostName}</p>
          <p className="text-xs text-muted-foreground mt-1">
            {formatDate(m.startedAt)}
            {m.endedAt ? ` — ${formatDate(m.endedAt)}` : " (in progress)"}
          </p>
        </div>

        {/* Meeting stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Clock} label="Duration" value={formatDuration(m.duration)} color="blue" />
          <StatCard icon={Users} label="Peak Participants" value={String(m.peakParticipants)} color="green" />
          <StatCard icon={MessageCircle} label="Messages" value={String(m.totalMessages)} color="purple" />
          <StatCard icon={ThumbsUp} label="Reactions" value={String(m.totalReactions)} color="yellow" />
          <StatCard icon={HelpCircle} label="Questions" value={String(m.totalQuestions)} color="orange" />
          <StatCard icon={Hand} label="Hand Raises" value={String(m.totalHandRaises)} color="red" />
          <StatCard icon={Users} label="Restaurants" value={String(m.totalLocations)} color="teal" />
          <StatCard icon={Users} label="ARLs + Guests" value={String(m.totalArls + m.totalGuests)} color="indigo" />
        </div>

        {/* Participants table */}
        <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-700">
            <h4 className="text-sm font-semibold text-white">Participants ({participants.length})</h4>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-muted-foreground text-xs border-b border-border">
                  <th className="text-left px-4 py-2 font-medium">Name</th>
                  <th className="text-left px-4 py-2 font-medium">Type</th>
                  <th className="text-left px-4 py-2 font-medium">Role</th>
                  <th className="text-center px-4 py-2 font-medium">Duration</th>
                  <th className="text-center px-4 py-2 font-medium">Msgs</th>
                  <th className="text-center px-4 py-2 font-medium">Q&A</th>
                  <th className="text-center px-4 py-2 font-medium">Reactions</th>
                  <th className="text-center px-4 py-2 font-medium">Hands</th>
                  <th className="text-center px-4 py-2 font-medium">Muted</th>
                </tr>
              </thead>
              <tbody>
                {participants.map(p => (
                  <tr key={p.id} className="border-b border-slate-700/50 hover:bg-slate-700/30">
                    <td className="px-4 py-2 text-white font-medium">{p.participantName}</td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs px-2 py-0.5 rounded-full",
                        p.participantType === "arl" ? "bg-blue-600/20 text-blue-400" :
                        p.participantType === "guest" ? "bg-purple-600/20 text-purple-400" :
                        "bg-green-600/20 text-green-400"
                      )}>
                        {p.participantType === "arl" ? "ARL" : p.participantType === "guest" ? "Guest" : "Restaurant"}
                      </span>
                    </td>
                    <td className="px-4 py-2">
                      <span className={cn(
                        "text-xs",
                        p.role === "host" ? "text-yellow-400" : p.role === "cohost" ? "text-blue-400" : "text-muted-foreground"
                      )}>
                        {p.role}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-center text-slate-300">{formatDuration(p.duration)}</td>
                    <td className="px-4 py-2 text-center text-slate-300">{p.messagesSent}</td>
                    <td className="px-4 py-2 text-center text-slate-300">{p.questionsSent}</td>
                    <td className="px-4 py-2 text-center text-slate-300">{p.reactionsSent}</td>
                    <td className="px-4 py-2 text-center text-slate-300">{p.handRaiseCount}</td>
                    <td className="px-4 py-2 text-center">
                      {p.wasMutedByHost ? (
                        <span className="text-red-400 text-xs">Yes</span>
                      ) : (
                        <span className="text-muted-foreground text-xs">No</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Overview
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-bold text-black flex items-center gap-2">
          <BarChart3 className="h-5 w-5 text-blue-400" />
          Meeting Analytics
        </h2>
        {meetings.length > 0 && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors"
          >
            <Trash2 className="h-4 w-4" />
            Delete All
          </button>
        )}
      </div>

      {/* Delete confirmation dialog */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="bg-slate-800 rounded-xl shadow-2xl p-6 max-w-md mx-4 border border-slate-700">
            <div className="flex items-center gap-3 mb-4">
              <div className="h-12 w-12 rounded-full bg-red-600/20 flex items-center justify-center">
                <Trash2 className="h-6 w-6 text-red-400" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-white">Delete All Meeting Data?</h3>
                <p className="text-sm text-muted-foreground">This action cannot be undone</p>
              </div>
            </div>
            <p className="text-sm text-foreground mb-6">
              This will permanently delete all meeting analytics data including:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 mb-6 ml-4">
              <li>• All meeting records ({meetings.length} meetings)</li>
              <li>• All participant data</li>
              <li>• All statistics and summaries</li>
            </ul>
            <div className="flex gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-slate-700 hover:bg-slate-600 text-white text-sm font-medium transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteAll}
                disabled={deleting}
                className="flex-1 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {deleting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Deleting...
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    Delete All
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Summary cards */}
      {summary && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard icon={Video} label="Total Meetings" value={String(summary.totalMeetings)} color="blue" />
          <StatCard icon={Clock} label="Avg Duration" value={formatDuration(summary.avgDuration)} color="green" />
          <StatCard icon={Users} label="Avg Participants" value={String(summary.avgParticipants)} color="purple" />
          <StatCard icon={MessageCircle} label="Total Messages" value={String(summary.totalMessages)} color="yellow" />
          <StatCard icon={ThumbsUp} label="Total Reactions" value={String(summary.totalReactions)} color="orange" />
          <StatCard icon={HelpCircle} label="Total Questions" value={String(summary.totalQuestions)} color="red" />
          <StatCard icon={Hand} label="Total Hand Raises" value={String(summary.totalHandRaises)} color="teal" />
          <StatCard icon={Clock} label="Total Duration" value={formatDuration(summary.totalDuration)} color="indigo" />
        </div>
      )}

      {/* Meeting list */}
      <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
        <div className="px-4 py-3 border-b border-slate-700">
          <h4 className="text-sm font-semibold text-white">Recent Meetings</h4>
        </div>
        {meetings.length === 0 ? (
          <div className="p-8 text-center text-muted-foreground">
            <Video className="h-10 w-10 mx-auto mb-3 opacity-50" />
            <p>No meeting data yet.</p>
            <p className="text-xs mt-1">Analytics will appear after your first meeting.</p>
          </div>
        ) : (
          <div className="divide-y divide-slate-700/50">
            {meetings.map(m => (
              <button
                key={m.id}
                onClick={() => fetchDetail(m.id)}
                className="w-full px-4 py-3 flex items-center justify-between hover:bg-slate-700/30 transition-colors text-left"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white truncate">{m.title}</span>
                    {!m.endedAt && (
                      <span className="text-[10px] bg-red-600/20 text-red-400 px-1.5 py-0.5 rounded-full">LIVE</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3 mt-0.5">
                    <span className="text-xs text-muted-foreground">{formatDate(m.startedAt)}</span>
                    <span className="text-xs text-muted-foreground">•</span>
                    <span className="text-xs text-muted-foreground">{m.hostName}</span>
                  </div>
                </div>
                <div className="flex items-center gap-4 shrink-0 ml-4">
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{m.peakParticipants}</p>
                    <p className="text-[10px] text-muted-foreground">participants</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{formatDuration(m.duration)}</p>
                    <p className="text-[10px] text-muted-foreground">duration</p>
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-bold text-white">{m.totalMessages}</p>
                    <p className="text-[10px] text-muted-foreground">messages</p>
                  </div>
                  <ChevronRight className="h-4 w-4 text-muted-foreground" />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// Reusable stat card
function StatCard({ icon: Icon, label, value, color }: {
  icon: any; label: string; value: string; color: string;
}) {
  const colorClasses: Record<string, string> = {
    blue: "bg-blue-600/20 text-blue-400",
    green: "bg-green-600/20 text-green-400",
    purple: "bg-purple-600/20 text-purple-400",
    yellow: "bg-yellow-600/20 text-yellow-400",
    orange: "bg-orange-600/20 text-orange-400",
    red: "bg-red-600/20 text-red-400",
    teal: "bg-teal-600/20 text-teal-400",
    indigo: "bg-indigo-600/20 text-indigo-400",
  };

  return (
    <div className="bg-slate-800 rounded-xl p-3 border border-slate-700">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn("h-7 w-7 rounded-lg flex items-center justify-center", colorClasses[color] || colorClasses.blue)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
      </div>
      <p className="text-lg font-bold text-white">{value}</p>
      <p className="text-[10px] text-slate-500 uppercase tracking-wide">{label}</p>
    </div>
  );
}
