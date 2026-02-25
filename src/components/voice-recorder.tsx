"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { Mic, Square, Play, Pause, Trash2, Send, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface VoiceRecorderProps {
  onSend: (audioBlob: Blob, durationMs: number) => void;
  disabled?: boolean;
  maxDurationMs?: number;
}

export function VoiceRecorder({ onSend, disabled, maxDurationMs = 60000 }: VoiceRecorderProps) {
  const [recording, setRecording] = useState(false);
  const [recorded, setRecorded] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const audioBlobRef = useRef<Blob | null>(null);
  const audioUrlRef = useRef<string>("");
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout>(undefined);
  const startTimeRef = useRef(0);

  const cleanup = useCallback(() => {
    if (audioUrlRef.current) URL.revokeObjectURL(audioUrlRef.current);
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null; }
    if (timerRef.current) clearInterval(timerRef.current);
    audioBlobRef.current = null;
    audioUrlRef.current = "";
    chunksRef.current = [];
    setRecording(false);
    setRecorded(false);
    setPlaying(false);
    setDuration(0);
    setCurrentTime(0);
  }, []);

  // Cleanup on unmount
  useEffect(() => cleanup, [cleanup]);

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream, { mimeType: "audio/webm;codecs=opus" });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];
      startTimeRef.current = Date.now();

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(chunksRef.current, { type: "audio/webm" });
        audioBlobRef.current = blob;
        audioUrlRef.current = URL.createObjectURL(blob);
        setDuration(Date.now() - startTimeRef.current);
        setRecorded(true);
        setRecording(false);
        if (timerRef.current) clearInterval(timerRef.current);
      };

      mediaRecorder.start(100);
      setRecording(true);

      // Timer for display
      timerRef.current = setInterval(() => {
        const elapsed = Date.now() - startTimeRef.current;
        setCurrentTime(elapsed);
        if (elapsed >= maxDurationMs) {
          mediaRecorder.stop();
        }
      }, 100);
    } catch (err) {
      console.error("Microphone access denied:", err);
    }
  }, [maxDurationMs]);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === "recording") {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const playRecording = useCallback(() => {
    if (!audioUrlRef.current) return;
    const audio = new Audio(audioUrlRef.current);
    audioRef.current = audio;
    audio.onended = () => setPlaying(false);
    audio.ontimeupdate = () => setCurrentTime(audio.currentTime * 1000);
    audio.play();
    setPlaying(true);
  }, []);

  const pausePlayback = useCallback(() => {
    audioRef.current?.pause();
    setPlaying(false);
  }, []);

  const handleSend = useCallback(() => {
    if (audioBlobRef.current) {
      onSend(audioBlobRef.current, duration);
      cleanup();
    }
  }, [onSend, duration, cleanup]);

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  if (disabled) return null;

  // Not recording, not recorded — show mic button
  if (!recording && !recorded) {
    return (
      <button
        onClick={startRecording}
        className="flex h-9 w-9 items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors dark:bg-red-900 dark:text-red-400 dark:hover:bg-red-800"
        title="Record voice message"
      >
        <Mic className="h-4 w-4" />
      </button>
    );
  }

  // Recording in progress
  if (recording) {
    return (
      <div className="flex items-center gap-2 rounded-full bg-red-50 px-3 py-1.5 dark:bg-red-950">
        <div className="h-2.5 w-2.5 animate-pulse rounded-full bg-red-500" />
        <span className="text-xs font-medium text-red-700 dark:text-red-300 tabular-nums">{formatTime(currentTime)}</span>
        <div className="mx-1 h-4 w-px bg-red-200 dark:bg-red-800" />
        <button onClick={stopRecording} className="flex h-7 w-7 items-center justify-center rounded-full bg-red-600 text-white hover:bg-red-700 transition-colors" title="Stop recording">
          <Square className="h-3 w-3" />
        </button>
        <button onClick={cleanup} className="flex h-7 w-7 items-center justify-center rounded-full text-red-400 hover:text-red-600 hover:bg-red-100 transition-colors dark:hover:bg-red-900" title="Cancel">
          <Trash2 className="h-3 w-3" />
        </button>
      </div>
    );
  }

  // Recorded — preview + send
  return (
    <div className="flex items-center gap-2 rounded-full bg-blue-50 px-3 py-1.5 dark:bg-blue-950">
      <button
        onClick={playing ? pausePlayback : playRecording}
        className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors"
        title={playing ? "Pause" : "Play"}
      >
        {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3 ml-0.5" />}
      </button>
      <span className="text-xs font-medium text-blue-700 dark:text-blue-300 tabular-nums">{formatTime(playing ? currentTime : duration)}</span>
      <div className="mx-1 h-4 w-px bg-blue-200 dark:bg-blue-800" />
      <button onClick={cleanup} className="flex h-7 w-7 items-center justify-center rounded-full text-blue-400 hover:text-red-500 hover:bg-blue-100 transition-colors dark:hover:bg-blue-900" title="Delete">
        <Trash2 className="h-3 w-3" />
      </button>
      <button onClick={handleSend} className="flex h-7 w-7 items-center justify-center rounded-full bg-green-600 text-white hover:bg-green-700 transition-colors" title="Send voice message">
        <Send className="h-3 w-3" />
      </button>
    </div>
  );
}

// Audio message player component for rendering received voice messages
export function VoiceMessagePlayer({ audioUrl, duration }: { audioUrl: string; duration: number }) {
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const toggle = () => {
    if (playing) {
      audioRef.current?.pause();
      setPlaying(false);
    } else {
      const audio = audioRef.current ?? new Audio(audioUrl);
      audioRef.current = audio;
      audio.onended = () => { setPlaying(false); setProgress(0); };
      audio.ontimeupdate = () => setProgress((audio.currentTime / audio.duration) * 100 || 0);
      audio.play().catch(() => {});
      setPlaying(true);
    }
  };

  const formatTime = (ms: number) => {
    const s = Math.floor(ms / 1000);
    const m = Math.floor(s / 60);
    return `${m}:${String(s % 60).padStart(2, "0")}`;
  };

  return (
    <div className="flex items-center gap-2 rounded-xl bg-blue-50 px-3 py-2 dark:bg-blue-950">
      <button onClick={toggle} className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white hover:bg-blue-700 transition-colors">
        {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5 ml-0.5" />}
      </button>
      <div className="flex-1">
        <div className="h-1.5 rounded-full bg-blue-200 dark:bg-blue-800 overflow-hidden">
          <div className="h-full rounded-full bg-blue-600 transition-all" style={{ width: `${progress}%` }} />
        </div>
      </div>
      <span className="text-xs font-medium text-blue-600 dark:text-blue-400 tabular-nums">{formatTime(duration)}</span>
      <Mic className="h-3.5 w-3.5 text-blue-400" />
    </div>
  );
}
