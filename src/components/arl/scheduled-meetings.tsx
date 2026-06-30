"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";
import { ConfirmDialog, useConfirmDialog } from "@/components/confirm-dialog";
import { motion, AnimatePresence } from "framer-motion";
import {
  Video, Plus, Trash2, Copy, Check, Clock, Calendar,
  Users, Lock, Globe, RefreshCw, Edit2, X, ChevronDown, Play, MoreVertical,
} from "@/lib/icons";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectTrigger, SelectValueText, SelectContent, SelectItem, createListCollection } from "@/components/ui/select";
import { Menu, MenuTrigger, MenuContent, MenuItem } from "@/components/ui/menu";
import { IconTip } from "@/components/ui/icon-tip";
import { EmptyState } from "@/components/ui/empty-state";
import { cn } from "@/lib/utils";
import { useSocket } from "@/lib/socket-context";
import { useAuth } from "@/lib/auth-context";
import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";
import {
  getBrowserTimeZone,
  getTimeZoneList,
  timeZoneLabel,
  zonedWallTimeToUtcISO,
  formatDateTimeInZone,
  formatTimeInZone,
} from "@/lib/tz-format";

interface ScheduledMeeting {
  id: string;
  meeting_code: string;
  title: string;
  description: string | null;
  password: string | null;
  host_id: string;
  host_name: string;
  scheduled_at: string;
  timezone: string | null;
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
  const [timezone, setTimezone] = useState<string>(() => getBrowserTimeZone());
  const tzOptions = useRef<{ value: string; label: string }[]>(
    getTimeZoneList().map((tz) => ({ value: tz, label: timeZoneLabel(tz) }))
  );
  const tzCollection = useMemo(() => createListCollection({ items: tzOptions.current }), []);
  const [durationMinutes, setDurationMinutes] = useState(60);
  const [isRecurring, setIsRecurring] = useState(false);
  const [recurringType, setRecurringType] = useState<string>("weekly");
  const [recurringDays, setRecurringDays] = useState<string[]>([]);
  const [allowGuests, setAllowGuests] = useState(true);
  const [creating, setCreating] = useState(false);

  // Direct meeting start state
  const [activeMeeting, setActiveMeeting] = useState<{ id: string; title: string; hostId: string } | null>(null);
  const { socket } = useSocket();
  const { user } = useAuth();

  const handleStartMeetingDirect = (meetingTitle: string, meetingCode: string, hostId: string) => {
    if (!socket) return;
    const meetingId = `scheduled-${meetingCode}`;
    socket.emit("meeting:create", { meetingId, title: meetingTitle });
    setActiveMeeting({ id: meetingId, title: meetingTitle, hostId });
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
    setTimezone(getBrowserTimeZone());
    setDurationMinutes(60); setIsRecurring(false);
    setRecurringType("weekly"); setRecurringDays([]);
    setAllowGuests(true);
  };

  const handleCreate = async () => {
    if (!title.trim() || !scheduledDate || !scheduledTime) return;
    setCreating(true);
    try {
      // Interpret the entered date/time in the SELECTED timezone (not the
      // organizer's browser tz) so the stored instant is correct for everyone.
      const scheduledAt = zonedWallTimeToUtcISO(scheduledDate, scheduledTime, timezone);
      const res = await fetch("/api/meetings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          password: password.trim() || undefined,
          scheduledAt,
          timezone,
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

  const { dialog, confirm: showConfirm } = useConfirmDialog();

  const handleDelete = (id: string) => {
    const meeting = meetings.find((m) => m.id === id);
    showConfirm({
      title: "Delete Meeting",
      description: `Delete ${meeting?.title ?? "this meeting"}? This cannot be undone.`,
      confirmLabel: "Delete",
      variant: "danger",
      onConfirm: async () => {
        try {
          await fetch(`/api/meetings?id=${id}`, { method: "DELETE" });
          fetchMeetings();
        } catch {}
      },
    });
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

  // Create a secure one-click invite link (opaque token — never the password)
  // and copy it to the clipboard. expiresInHours = null → reusable, no expiry.
  const createInviteLink = async (
    m: { id: string; title: string; meeting_code: string },
    expiresInHours: number | null
  ) => {
    const key = `invite-${m.id}${expiresInHours ? "-exp" : ""}`;
    try {
      const res = await fetch("/api/meetings/invites", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ meetingCode: m.meeting_code, expiresInHours }),
      });
      const data = await res.json();
      if (!res.ok || !data.ok || !data.url) {
        setCopiedCode(`err-${m.id}`);
        setTimeout(() => setCopiedCode(null), 2000);
        return;
      }
      const text = `Join meeting "${m.title}"\nOne-click join: ${data.url}${
        expiresInHours ? "\n(This link expires in 24 hours)" : ""
      }`;
      await navigator.clipboard.writeText(text);
      setCopiedCode(key);
      setTimeout(() => setCopiedCode(null), 2000);
    } catch {
      setCopiedCode(`err-${m.id}`);
      setTimeout(() => setCopiedCode(null), 2000);
    }
  };

  const toggleDay = (day: string) => {
    setRecurringDays(prev =>
      prev.includes(day) ? prev.filter(d => d !== day) : [...prev, day]
    );
  };

  // If in a meeting, render MeetingRoom fullscreen
  if (activeMeeting) {
    const isHost = user?.id === activeMeeting.hostId;
    return (
      <MeetingRoom
        meetingId={activeMeeting.id}
        title={activeMeeting.title}
        isHost={isHost}
        onLeave={handleLeaveMeeting}
      />
    );
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-red-500/10 flex items-center justify-center">
            <Video className="h-5 w-5 text-red-600 dark:text-red-400" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-foreground">Scheduled Meetings</h2>
            <p className="text-xs text-muted-foreground">{meetings.length} meeting{meetings.length !== 1 ? "s" : ""}</p>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          {onStartOnDemand && (
            <Button
              onClick={onStartOnDemand}
              className="rounded-xl font-semibold text-sm bg-red-600 active:bg-red-700 text-white whitespace-nowrap"
            >
              <Play className="h-4 w-4 mr-2" />
              <span className="hidden sm:inline">Start Meeting</span>
              <span className="sm:hidden">Start</span>
            </Button>
          )}
          <Button
            variant="outline"
            onClick={() => { setShowCreate(!showCreate); if (showCreate) resetForm(); }}
            className="rounded-xl font-semibold text-sm whitespace-nowrap"
          >
            {showCreate ? <><X className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Cancel</span></> : <><Plus className="h-4 w-4 mr-2" /><span className="hidden sm:inline">Schedule Meeting</span><span className="sm:hidden">Schedule</span></>}
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
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            <div className="bg-card rounded-xl border border-border p-5 space-y-4">
              <h3 className="font-semibold text-sm text-foreground">Create New Meeting</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Title *</label>
                  <Input value={title} onChange={e => setTitle(e.target.value)} placeholder="Weekly Team Standup" />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Password (optional)</label>
                  <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Meeting password" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Description (optional)</label>
                <Input value={description} onChange={e => setDescription(e.target.value)} placeholder="Brief description..." />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Date *</label>
                  <Input type="date" value={scheduledDate} onChange={e => setScheduledDate(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Time *</label>
                  <Input type="time" value={scheduledTime} onChange={e => setScheduledTime(e.target.value)} />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-muted-foreground mb-1">Duration (min)</label>
                  <Input type="number" value={durationMinutes} onChange={e => setDurationMinutes(Number(e.target.value))} min={15} max={480} step={15} />
                </div>
              </div>

              {/* Timezone */}
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1">Timezone</label>
                <Select
                  collection={tzCollection}
                  value={[timezone]}
                  onValueChange={(d) => setTimezone(d.value[0])}
                >
                  <SelectTrigger className="h-9 w-full">
                    <SelectValueText />
                  </SelectTrigger>
                  <SelectContent>
                    {tzCollection.items.map((tz) => (
                      <SelectItem key={tz.value} item={tz}>{tz.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {scheduledDate && scheduledTime && (
                  <p className="mt-1 text-xs text-muted-foreground">
                    Starts {formatDateTimeInZone(zonedWallTimeToUtcISO(scheduledDate, scheduledTime, timezone), timezone)}
                  </p>
                )}
              </div>

              {/* Recurring */}
              <div className="space-y-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input type="checkbox" checked={isRecurring} onChange={e => setIsRecurring(e.target.checked)}
                    className="h-4 w-4 rounded border-input text-red-600 focus:ring-red-500" />
                  <span className="text-sm font-semibold text-foreground">Recurring meeting</span>
                </label>

                {isRecurring && (
                  <div className="pl-6 space-y-3">
                    <div className="flex gap-2">
                      {["daily", "weekly", "biweekly", "monthly"].map(type => (
                        <button key={type} onClick={() => setRecurringType(type)}
                          className={cn(
                            "px-3 py-2 rounded-lg text-xs font-semibold transition-colors",
                            recurringType === type ? "bg-red-600 text-white" : "bg-muted text-muted-foreground active:bg-muted/80"
                          )}>
                          {type.charAt(0).toUpperCase() + type.slice(1)}
                        </button>
                      ))}
                    </div>
                    {(recurringType === "weekly" || recurringType === "biweekly") && (
                      <div className="flex gap-1">
                        {DAYS_OF_WEEK.map(d => (
                          <button key={d.key} onClick={() => toggleDay(d.key)}
                            className={cn(
                              "h-8 w-8 rounded-full text-xs font-semibold transition-colors",
                              recurringDays.includes(d.key) ? "bg-red-600 text-white" : "bg-muted text-muted-foreground active:bg-muted/80"
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
                  className="h-4 w-4 rounded border-input text-red-600 focus:ring-red-500" />
                <span className="text-sm font-semibold text-foreground">Allow guest/outside participants</span>
              </label>

              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" onClick={() => { setShowCreate(false); resetForm(); }} className="rounded-xl">
                  Cancel
                </Button>
                <Button onClick={handleCreate} disabled={creating || !title.trim() || !scheduledDate || !scheduledTime}
                  className="bg-red-600 active:bg-red-700 text-white rounded-xl font-semibold">
                  {creating ? "Creating..." : "Create Meeting"}
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Meetings List */}
      {loading ? (
        <div className="text-center py-12 text-muted-foreground text-sm">Loading meetings...</div>
      ) : meetings.length === 0 ? (
        <EmptyState icon={Video} title="No scheduled meetings yet" subtext="Create one to get started" />
      ) : (
        <>
          {/* Desktop table — host/date/time/code is tabular, comparable
              data; same convention as locations-manager.tsx (Section 11). */}
          <div className="hidden md:block rounded-2xl border border-border bg-card overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-xs text-muted-foreground">
                  <th className="px-4 py-2.5 text-left font-semibold">Meeting</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Host</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Schedule</th>
                  <th className="px-4 py-2.5 text-left font-semibold">Code</th>
                  <th className="px-4 py-2.5 text-right font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody>
                {meetings.map((m) => {
                  const scheduledDate = new Date(m.scheduled_at);
                  return (
                    <tr key={m.id} className={cn("border-b border-border last:border-b-0", !m.is_active && "opacity-50")}>
                      <td className="px-4 py-3 max-w-64">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-foreground truncate">{m.title}</span>
                          {m.is_recurring ? (
                            <span className="flex items-center gap-1 text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-0.5 rounded-full shrink-0">
                              <RefreshCw className="h-2.5 w-2.5" />{m.recurring_type}
                            </span>
                          ) : null}
                          {!m.is_active && (
                            <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-0.5 rounded-full shrink-0">Inactive</span>
                          )}
                        </div>
                        {m.description && (
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">{m.description}</p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{m.host_name}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div className="flex flex-col gap-0.5">
                          <span className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            {scheduledDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {m.timezone
                              ? formatTimeInZone(m.scheduled_at, m.timezone)
                              : scheduledDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                            {" "}({m.duration_minutes}min)
                          </span>
                          {m.allow_guests ? (
                            <span className="flex items-center gap-1 text-green-600">
                              <Globe className="h-3 w-3" />Guests allowed
                            </span>
                          ) : (
                            <span className="flex items-center gap-1">
                              <Lock className="h-3 w-3" />Internal only
                            </span>
                          )}
                          {m.password && (
                            <span className="flex items-center gap-1 text-amber-600">
                              <Lock className="h-3 w-3" />Password set
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <span className="font-mono font-semibold text-red-600 tracking-wider">{m.meeting_code}</span>
                          <IconTip label="Copy meeting code">
                            <button
                              onClick={() => copyCode(m.meeting_code)}
                              className="p-1.5 rounded-lg active:bg-muted transition-colors text-muted-foreground active:text-foreground"
                              title="Copy meeting code"
                            >
                              {copiedCode === m.meeting_code ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                          </IconTip>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-1">
                          {m.is_active && (
                            <button
                              onClick={() => handleStartMeetingDirect(m.title, m.meeting_code, m.host_id)}
                              className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold bg-red-600 text-white active:bg-red-700 transition-colors"
                            >
                              <Play className="h-3 w-3" />{user?.id === m.host_id ? "Start" : "Join"}
                            </button>
                          )}
                          <button
                            onClick={() => handleToggleActive(m.id, m.is_active)}
                            className={cn(
                              "px-2 py-1 rounded-xl text-xs font-semibold transition-colors",
                              m.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 active:bg-emerald-500/20" : "bg-muted text-muted-foreground active:bg-muted/80"
                            )}
                          >
                            {m.is_active ? "Active" : "Activate"}
                          </button>
                          <Menu>
                            <MenuTrigger className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground outline-none active:bg-muted active:text-foreground">
                              <MoreVertical className="h-3.5 w-3.5" />
                            </MenuTrigger>
                            <MenuContent>
                              {m.allow_guests && (
                                <>
                                  <MenuItem value="invite-link" closeOnSelect={false} onClick={() => createInviteLink(m, null)}>
                                    <Copy className="h-3.5 w-3.5 shrink-0" />
                                    {copiedCode === `invite-${m.id}` ? "Copied!" : "Copy invite link"}
                                  </MenuItem>
                                  <MenuItem value="invite-link-24h" closeOnSelect={false} onClick={() => createInviteLink(m, 24)}>
                                    <Copy className="h-3.5 w-3.5 shrink-0" />
                                    {copiedCode === `invite-${m.id}-exp` ? "Copied!" : "Copy 24h link"}
                                  </MenuItem>
                                </>
                              )}
                              <MenuItem value="delete" variant="destructive" onClick={() => handleDelete(m.id)}>
                                <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete Meeting
                              </MenuItem>
                            </MenuContent>
                          </Menu>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile — stacked cards, same data */}
          <div className="md:hidden space-y-3">
            {meetings.map((m) => {
              const scheduledDate = new Date(m.scheduled_at);
              return (
                <motion.div
                  key={m.id}
                  layout
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.2, ease: "easeOut" }}
                  className={cn(
                    "bg-card rounded-xl border p-4 transition-colors",
                    m.is_active ? "border-border" : "border-border opacity-60"
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <h4 className="font-semibold text-sm text-foreground truncate">{m.title}</h4>
                        {m.is_recurring ? (
                          <span className="flex items-center gap-1 text-xs font-semibold bg-blue-500/10 text-blue-700 dark:text-blue-400 px-2 py-1 rounded-full">
                            <RefreshCw className="h-2.5 w-2.5" />{m.recurring_type}
                          </span>
                        ) : null}
                        {!m.is_active && (
                          <span className="text-xs font-semibold bg-muted text-muted-foreground px-2 py-1 rounded-full">Inactive</span>
                        )}
                      </div>

                      {m.description && (
                        <p className="text-xs text-muted-foreground mb-2 truncate">{m.description}</p>
                      )}

                      <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Users className="h-3 w-3" />
                          Host: {m.host_name}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {scheduledDate.toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" })}
                        </span>
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {m.timezone
                            ? formatTimeInZone(m.scheduled_at, m.timezone)
                            : scheduledDate.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                          {" "}({m.duration_minutes}min)
                        </span>
                        {m.allow_guests ? (
                          <span className="flex items-center gap-1 text-green-600">
                            <Globe className="h-3 w-3" />Guests allowed
                          </span>
                        ) : (
                          <span className="flex items-center gap-1 text-muted-foreground">
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
                      <div className="flex items-center gap-1">
                        <span className="font-mono text-lg font-semibold text-red-600 tracking-wider">{m.meeting_code}</span>
                        <IconTip label="Copy meeting code">
                          <button
                            onClick={() => copyCode(m.meeting_code)}
                            className="p-2 rounded-lg active:bg-muted transition-colors text-muted-foreground active:text-foreground"
                            title="Copy meeting code"
                          >
                            {copiedCode === m.meeting_code ? <Check className="h-3.5 w-3.5 text-green-500" /> : <Copy className="h-3.5 w-3.5" />}
                          </button>
                        </IconTip>
                      </div>
                      <div className="flex items-center gap-1">
                        {m.is_active && (
                          <button
                            onClick={() => handleStartMeetingDirect(m.title, m.meeting_code, m.host_id)}
                            className="flex items-center gap-1 px-2 py-1 rounded-xl text-xs font-semibold bg-red-600 text-white active:bg-red-700 transition-colors"
                          >
                            <Play className="h-3 w-3" />{user?.id === m.host_id ? "Start" : "Join"}
                          </button>
                        )}
                        <button
                          onClick={() => handleToggleActive(m.id, m.is_active)}
                          className={cn(
                            "px-2 py-1 rounded-xl text-xs font-semibold transition-colors",
                            m.is_active ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 active:bg-emerald-500/20" : "bg-muted text-muted-foreground active:bg-muted/80"
                          )}
                        >
                          {m.is_active ? "Active" : "Activate"}
                        </button>
                        <Menu>
                          <MenuTrigger className="flex h-7 w-7 items-center justify-center rounded-lg text-muted-foreground outline-none active:bg-muted active:text-foreground">
                            <MoreVertical className="h-3.5 w-3.5" />
                          </MenuTrigger>
                          <MenuContent>
                            {m.allow_guests && (
                              <>
                                <MenuItem value="invite-link" closeOnSelect={false} onClick={() => createInviteLink(m, null)}>
                                  <Copy className="h-3.5 w-3.5 shrink-0" />
                                  {copiedCode === `invite-${m.id}` ? "Copied!" : "Copy invite link"}
                                </MenuItem>
                                <MenuItem value="invite-link-24h" closeOnSelect={false} onClick={() => createInviteLink(m, 24)}>
                                  <Copy className="h-3.5 w-3.5 shrink-0" />
                                  {copiedCode === `invite-${m.id}-exp` ? "Copied!" : "Copy 24h link"}
                                </MenuItem>
                              </>
                            )}
                            <MenuItem value="delete" variant="destructive" onClick={() => handleDelete(m.id)}>
                              <Trash2 className="h-3.5 w-3.5 shrink-0" /> Delete Meeting
                            </MenuItem>
                          </MenuContent>
                        </Menu>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </>
      )}
      <ConfirmDialog {...dialog} />
    </div>
  );
}
