"use client";

import {
  Video, VideoOff, Mic, MicOff, Monitor, MonitorOff,
  PhoneOff, Hand, ArrowRightLeft, AudioLines,
} from "@/lib/icons";
import { LogOut } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { LocalParticipant } from "livekit-client";

interface ControlsBarProps {
  localParticipant: LocalParticipant;
  hasVideoCapability: boolean;
  myRole: string;
  handRaised: boolean;
  noiseSuppression: boolean;
  onToggleHand: () => void;
  onToggleNoiseSuppression: () => void;
  onShowTransferDialog: () => void;
  onLeaveMeeting: () => void;
  onEndMeeting: () => void;
}

export function ControlsBar({
  localParticipant,
  hasVideoCapability,
  myRole,
  handRaised,
  noiseSuppression,
  onToggleHand,
  onToggleNoiseSuppression,
  onShowTransferDialog,
  onLeaveMeeting,
  onEndMeeting,
}: ControlsBarProps) {
  return (
    <div className="bg-slate-800 border-t border-slate-700 px-4 py-3 flex items-center justify-center gap-2 shrink-0">
      <div className="flex-1" />

      <div className="flex items-center gap-2">
        {/* Mic toggle */}
        <button
          onClick={() => localParticipant.setMicrophoneEnabled(!localParticipant.isMicrophoneEnabled)}
          className={cn(
            "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
            localParticipant.isMicrophoneEnabled
              ? "bg-slate-700 hover:bg-slate-600 text-white"
              : "bg-red-600 hover:bg-red-700 text-white"
          )}
          title={localParticipant.isMicrophoneEnabled ? "Mute" : "Unmute"}
        >
          {localParticipant.isMicrophoneEnabled ? <Mic className="h-5 w-5" /> : <MicOff className="h-5 w-5" />}
        </button>

        {/* Video toggle (ARL only) */}
        {hasVideoCapability && (
          <button
            onClick={() => localParticipant.setCameraEnabled(!localParticipant.isCameraEnabled)}
            className={cn(
              "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
              localParticipant.isCameraEnabled
                ? "bg-slate-700 hover:bg-slate-600 text-white"
                : "bg-red-600 hover:bg-red-700 text-white"
            )}
            title={localParticipant.isCameraEnabled ? "Turn off camera" : "Turn on camera"}
          >
            {localParticipant.isCameraEnabled ? <Video className="h-5 w-5" /> : <VideoOff className="h-5 w-5" />}
          </button>
        )}

        {/* Screen share (host only) */}
        {myRole === "host" && (
          <button
            onClick={() => localParticipant.setScreenShareEnabled(!localParticipant.isScreenShareEnabled)}
            className={cn(
              "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
              localParticipant.isScreenShareEnabled
                ? "bg-blue-600 hover:bg-blue-700 text-white"
                : "bg-slate-700 hover:bg-slate-600 text-white"
            )}
            title={localParticipant.isScreenShareEnabled ? "Stop sharing" : "Share screen"}
          >
            {localParticipant.isScreenShareEnabled ? <MonitorOff className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}
          </button>
        )}

        {/* RNNoise noise suppression toggle */}
        <button
          onClick={onToggleNoiseSuppression}
          className={cn(
            "flex items-center justify-center h-10 px-4 rounded-full transition-colors",
            noiseSuppression
              ? "bg-green-600 hover:bg-green-700 text-white"
              : "bg-slate-700 hover:bg-slate-600 text-white"
          )}
          title={noiseSuppression ? "RNNoise: ON (click to disable)" : "RNNoise: OFF (click to enable)"}
        >
          <AudioLines className="h-5 w-5" />
        </button>

        {/* Raise hand (non-host) */}
        {myRole !== "host" && (
          <button
            onClick={onToggleHand}
            className={cn("flex items-center justify-center h-10 px-4 rounded-full transition-colors", handRaised ? "bg-yellow-600 hover:bg-yellow-700 text-white" : "bg-slate-700 hover:bg-slate-600 text-white")}
            title={handRaised ? "Lower hand" : "Raise hand"}
          >
            <Hand className="h-5 w-5" />
          </button>
        )}

        {/* Host: Transfer + Leave + End */}
        {myRole === "host" ? (
          <>
            <button
              onClick={onShowTransferDialog}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-purple-600 hover:bg-purple-700 text-white transition-colors"
              title="Transfer host role to another participant"
            >
              <ArrowRightLeft className="h-5 w-5" />
              <span className="text-xs font-medium hidden sm:inline">Transfer</span>
            </button>
            <button
              onClick={onLeaveMeeting}
              className="flex items-center gap-1.5 h-10 px-4 rounded-full bg-slate-700 hover:bg-slate-600 text-white transition-colors"
              title="Leave meeting (meeting continues)"
            >
              <LogOut className="h-5 w-5" />
              <span className="text-xs font-medium hidden sm:inline">Leave</span>
            </button>
            <button
              onClick={onEndMeeting}
              className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
              title="End meeting for all"
            >
              <PhoneOff className="h-5 w-5" />
              <span className="text-xs font-medium hidden sm:inline">End</span>
            </button>
          </>
        ) : (
          <button
            onClick={onLeaveMeeting}
            className="flex items-center gap-1.5 h-10 px-5 rounded-full bg-red-600 hover:bg-red-700 text-white transition-colors"
            title="Leave meeting"
          >
            <PhoneOff className="h-5 w-5" />
            <span className="text-xs font-medium hidden sm:inline">Leave</span>
          </button>
        )}
      </div>

      <div className="flex-1" />
    </div>
  );
}
