"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Plus, Trash2, Copy, Check, Clock, Calendar,
  Users, Lock, Globe, RefreshCw, Edit2, X, ChevronDown, Play,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { MeetingRoom } from "@/components/meeting-room";

interface ScheduledMeeting {
  id: string;
  meeting_code: string;
  title: string;
  description: string | null;
  password: string | null;
  host_id: string;
  host_name: string;
  scheduled_at: string;
  duration_minutes: number;
  is_recurring: number;
  recurring_type: string | null;
  recurring_days: string | null;
  allow_guests: number;
  is_active: number;
  created_at: string;
  updated_at: string;
}

const DAYS_OF_WEEK = [
  { key: "mon", label: "Mon" },
  { key: "tue", label: "Tue" },
  { key: "wed", label: "Wed" },
  { key: "thu", label: "Thu" },
  { key: "fri", label: "Fri" },
  { key: "sat", label: "Sat" },
  { key: "sun", label: "Sun" },
];

interface ScheduledMeetingsProps {
  onStartMeeting?: (title: string, meetingCode: string) => void;
  onStartOnDemand?: () => void;
}

export function ScheduledMeetings({ onStartMeeting, onStartOnDemand }: ScheduledMeetingsProps) {
  const [meetings, setMeetings] = useState<ScheduledMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Create form state
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [password, setPassword] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<string>("weekly");
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [allowGuests, setAllowGuests] = useState(true);
  const [creating, setCreating] = useState(false);

  // Direct meeting start state
  const [activeMeeting, setActiveMeeting] = useState<{ id: string; title: string } | null>(null);
  const { socket } = useSocket();

  const handleStartMeetingDirect = (meetingTitle: string, meetingCode: string) => {
    if (!socket) return;
    const meetingId = `scheduled-${meetingCode}`;
    socket.emit("meeting:create", { meetingId, title: meetingTitle });
    setActiveMeeting({ id: meetingId, title: meetingTitle });
  };

  const handleLeaveMeeting = () => {
    setActiveMeeting(null);
  };

  const fetchMeetings = useCallback(async () => {
    try {
      const res = await fetch("/api/meetings?active=false");
      if (res.ok) {
        const data = await res.json();
        setMeetings(data.meetings);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchMeetings(); }, [fetchMeetings]);

  const resetForm = () => {
    setTitle(""); setDescription(""); setPassword("");
    setScheduledDate(""); setScheduledTime("");
    setDurationMinutes(60); setIsRecurring(false);
    setRecurringType("weekly"); setRecurringDays([]);
    setAllowGuests(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !scheduledDate || !scheduledTime) return;
    setCreating(true);
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString();
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          password: password.trim() || undefined,
          scheduledAt,
          durationMinutes,
          isRecurring,
          recurringType: isRecurring ? recurringType : undefined,
          recurringDays: isRecurring ? recurringDays : undefined,
          allowGuests,
        }),
      });
      if (res.ok) {
        resetForm();
        setShowCreate(false);
        fetchMeetings();
      }
    } catch {} finally {
      setCreating(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Delete this scheduled meeting?")) return;
    try {
      await fetch(`/api/meetings?id=${id}`, { method: "DELETE" });
      fetchMeetings();
    } catch {}
  };

  const handleToggleActive = async (id: string, currentActive: number) => {
    try {
      await fetch("/api/meetings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, isActive: !currentActive }),
      });
      fetchMeetings();
    } catch {}
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const getAppUrl = () => {
    if (typeof window !== "undefined") return window.location.origin;
    return "";
  };

  const toggleDay = (day: string) => {
    setRecurringDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // If in a meeting, render MeetingRoom fullscreen
  if (activeMeeting) {
    return (
      <MeetingRoom
        meetingId={activeMeeting.id}
        title={activeMeeting.title}
        isHost={true}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-100 flex items-center justify-center">
            <Video className="h-5 w-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-slate-800">Scheduled Meetings</h2>
            <p className="text-xs text-slate-500">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {onStartOnDemand && (
            <Button
              onClick={onStartOnDemand}
              className="rounded-xl font-semibold text-sm bg-red-600 hover:bg-red-700 text-white"
            >
              <Play className="h-4 w-4 mr-1.5" />Start Meeting
            </Button>
          )}
          <Button
            onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm(); }}
            className={cn(
              "rounded-xl font-semibold text-sm",
              showCreate ? "bg-slate-200 text-slate-700 hover:bg-slate-300" : "bg-slate-700 hover:bg-slate-800 text-white"
            )}
          >
            {showCreate ? <><X className="h-4 w-4 mr-1.5" />Cancel</> : <><Plus className="h-4 w-4 mr-1.5" />Schedule Meeting</>}
          </Button>
        </div>
      </div>

      {/* Create Form */}
      <AnimatePresence>
        {showCreate && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
              <h3 className="font-bold text-sm text-slate-700">Create New Meeting</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Title *</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly Team Standup" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Password (optional)</label>
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Meeting password" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1">Description (optional)</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Date *</label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Time *</label>
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-600 mb-1">Duration (min)</label>
                  <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} min={15} max={480} step={15} />
                </div>
              </div>

              {/* Recurring */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                  <span className="text-sm font-medium text-slate-700">Recurring meeting</span>
                </label>

                {isRecurring && (
                  <div className="pl-6 space-y-3">
                    <div className="flex gap-2">
                      {["daily", "weekly", "biweekly", "monthly"].map(type => (
                        <button key={type} onClick={() => setRecurringType(type)}
                          className={cn(
                            "px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors",
                            recurringType === type ? "bg-red-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                          )}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                    {(recurringType === "weekly" || recurringType === "biweekly") && (
                      <div className="flex gap-1.5">
                        {DAYS_OF_WEEK.map(d => (
                          <button key={d.key} onClick={() => toggleDay(d.key)}
                            className={cn(
                              "h-8 w-8 rounded-full text-xs font-bold transition-colors",
                              recurringDays.includes(d.key) ? "bg-red-600 text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                            )}>
                            {d.label.charAt(0)}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Guest access */}
              <label className="flex items-center gap-2 cursor-pointer">
                <input type="checkbox" checked={allowGuests} onChange={e => setAllowGuests(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                <span className="text-sm font-medium text-slate-700">Allow guest/outside participants</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }} className="rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating || !title.trim() || !scheduledDate || !scheduledTime}
                  className="bg-red-600 hover:bg-red-700 text-white rounded-xl font-semibold">
                  {creating ? "Creating..." : "Create Meeting"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meetings List */}
      {loading ? (
        <div className="text-center py-12 text-slate-400 text-sm">Loading meetings...</div>
      ) : meetings.length === 0 ? (
        <div className="text-center py-12">
          <Video className="h-10 w-10 text-slate-300 mx-auto mb-3" />
          <p className="text-sm text-slate-500">No scheduled meetings yet</p>
          <p className="text-xs text-slate-400 mt-1">Create one to get started</p>
        </div>
      ) : (
        <div className="space-y-3">
          {meetings.map(m => {
            const scheduledDate = new Date(m.scheduled_at);
            const isPast = scheduledDate < new Date();
            const joinUrl = `${getAppUrl()}/meeting`;

            return (
              <motion.div
                key={m.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  "bg-white rounded-xl border p-4 transition-colors",
                  m.is_active ? "border-slate-200" : "border-slate-100 opacity-60"
                )}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <h4 className="font-bold text-sm text-slate-800 truncate">{m.title}</h4>
                      {m.is_recurring ? (
                        <span className="flex items-center gap-1 text-[10px] font-bold bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">
                          <RefreshCw className="h-2.5 w-2.5" />{m.recurring_type}
                        </span>
                      ) : null}
                      {!m.is_active && (
                        <span className="text-[10px] font-bold bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded-full">Inactive</span>
                      )}
                    </div>

                    {m.description && (
                      <p className="text-xs text-slate-500 mb-2 truncate">{m.description}</p>
                    )}

                    <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500">
                      <span className="flex items-center gap-1">
                        <Calendar className="h-3 w-3" />
                        {scheduledDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                      </span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {scheduledDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                        {" "}({m.duration_minutes}min)
                      </span>
                      {m.allow_guests ? (
                        <span className="flex items-center gap-1 text-green-600">
                          <Globe className="h-3 w-3" />Guests allowed
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-slate-400">
                          <Lock className="h-3 w-3" />Internal only
                        </span>
                      )}
                      {m.password && (
                        <span className="flex items-center gap-1 text-amber-600">
                          <Lock className="h-3 w-3" />Password set
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Meeting code + actions */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono text-lg font-bold text-red-600 tracking-wider">{m.meeting_code}</span>
                      <button
                        onClick={() => copyCode(m.meeting_code)}
                        className="p-1.5 rounded-lg hover:bg-slate-100 transition-colors text-slate-400 hover:text-slate-600"
                        title="Copy meeting code"
                      >
                        {copiedCode === m.meeting_code ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                      </button>
                    </div>
                    <div className="flex items-center gap-1">
                      {m.is_active && (
                        <button
                          onClick={() => handleStartMeetingDirect(m.title, m.meeting_code)}
                          className="flex items-center gap-1 px-2.5 py-1 rounded-md text-[10px] font-bold bg-red-600 text-white hover:bg-red-700 transition-colors"
                        >
                          <Play className="h-3 w-3" />Start
                        </button>
                      )}
                      <button
                        onClick={() => handleToggleActive(m.id, m.is_active)}
                        className={cn(
                          "px-2 py-1 rounded-md text-[10px] font-bold transition-colors",
                          m.is_active ? "bg-green-100 text-green-700 hover:bg-green-200" : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                      >
                        {m.is_active ? "Active" : "Activate"}
                      </button>
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1 rounded-md text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                        title="Delete meeting"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {m.allow_guests && (
                      <button
                        onClick={() => {
                          const text = `Join meeting "${m.title}"\nCode: ${m.meeting_code}${m.password ? `\nPassword: ${m.password}` : ""}\nJoin at: ${joinUrl}`;
                          navigator.clipboard.writeText(text);
                          setCopiedCode(`invite-${m.id}`);
                          setTimeout(() => setCopiedCode(null), 2000);
                        }}
                        className="text-[10px] font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                      >
                        {copiedCode === `invite-${m.id}` ? "Copied!" : "Copy invite link"}
                      </button>
                    )}
                  </div>
                </div>
              </motion.div>
            );
          })}
        </div>
      )}
    </div>
  );
}
