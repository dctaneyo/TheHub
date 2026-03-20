"use client";

import { X, Mic, MicOff, Hand, Crown, Shield, Edit3 } from "@/lib/icons";
import { cn } from "@/lib/utils";
import type { LocalParticipant, RemoteParticipant } from "livekit-client";

interface ParticipantPanelProps {
  participants: (LocalParticipant | RemoteParticipant)[];
  localParticipant: LocalParticipant;
  participantNicknames: Map<string, string>;
  raisedHands: Set<string>;
  isHostOrCohost: boolean;
  localIsHost: boolean;
  meetingId: string;
  onClose: () => void;
  onMuteAll: () => void;
  onUnmuteAll: () => void;
  onLowerAllHands: () => void;
  onMuteParticipant: (identity: string) => void;
  onUnmuteParticipant: (identity: string) => void;
  onLowerHand: (identity: string) => void;
  onRenameParticipant: (identity: string, currentName: string) => void;
}

function isHandRaised(p: LocalParticipant | RemoteParticipant, raisedHands: Set<string>): boolean {
  if (raisedHands.has(p.identity)) return true;
  try {
    const meta = p.metadata ? JSON.parse(p.metadata) : {};
    return !!meta.handRaised;
  } catch { return false; }
}

export function ParticipantPanel({
  participants,
  localParticipant,
  participantNicknames,
  raisedHands,
  isHostOrCohost,
  localIsHost,
  onClose,
  onMuteAll,
  onUnmuteAll,
  onLowerAllHands,
  onMuteParticipant,
  onUnmuteParticipant,
  onLowerHand,
  onRenameParticipant,
}: ParticipantPanelProps) {
  return (
    <div className="flex-1 flex flex-col">
      <div className="p-4 border-b border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-white font-bold text-sm">Participants ({participants.length})</h3>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 sm:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>
        {localIsHost && (
          <div className="flex gap-2">
            <button
              onClick={onMuteAll}
              className="flex-1 px-2 py-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/30 text-red-400 text-xs font-semibold transition-colors"
              title="Mute all participants"
            >
              Mute All
            </button>
            <button
              onClick={onUnmuteAll}
              className="flex-1 px-2 py-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/30 text-green-400 text-xs font-semibold transition-colors"
              title="Unmute all participants"
            >
              Unmute All
            </button>
            <button
              onClick={onLowerAllHands}
              className="flex-1 px-2 py-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/30 text-amber-400 text-xs font-semibold transition-colors"
              title="Lower all raised hands"
            >
              Lower All Hands
            </button>
          </div>
        )}
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-1">
        {participants.map(p => {
          const metadata = p.metadata ? JSON.parse(p.metadata) : {};
          const isLocal = p === localParticipant;
          const raised = isHandRaised(p, raisedHands);
          return (
            <div key={p.identity} className="flex items-center gap-2 p-2 rounded-lg hover:bg-slate-700/50">
              <div
                className={cn(
                  "h-8 w-8 rounded-full flex items-center justify-center text-xs font-bold text-white",
                  isLocal ? "bg-red-600" : metadata.userType === "arl" ? "bg-blue-600" : "bg-slate-600"
                )}
              >
                {p.name?.charAt(0) || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <span className="text-sm text-white font-medium truncate block">
                  {participantNicknames.get(p.identity) || p.name} {isLocal && "(You)"}
                </span>
                <span className="text-[10px] text-slate-400 capitalize">
                  {metadata.role || "participant"} • {metadata.userType || "guest"}
                  {participantNicknames.has(p.identity) && <span className="text-slate-500"> • {p.name}</span>}
                </span>
              </div>
              <div className="flex items-center gap-1">
                {raised && <Hand className="h-3.5 w-3.5 text-yellow-400" />}
                {p.isMicrophoneEnabled === false && <MicOff className="h-3 w-3 text-red-400" />}
                {metadata.role === "host" && <Crown className="h-3.5 w-3.5 text-yellow-400" />}
                {metadata.role === "cohost" && <Shield className="h-3.5 w-3.5 text-blue-400" />}
                <button
                  onClick={() => {
                    const currentName = participantNicknames.get(p.identity) || p.name || "";
                    onRenameParticipant(p.identity, currentName);
                  }}
                  title="Rename participant"
                  className="p-1 rounded-lg hover:bg-slate-600 text-slate-400 hover:text-slate-200 transition-colors"
                >
                  <Edit3 className="h-3 w-3" />
                </button>
                {isHostOrCohost && metadata.role !== "host" && !isLocal && (
                  <div className="flex gap-1 ml-2">
                    {raised && (
                      <button
                        onClick={() => onLowerHand(p.identity)}
                        title="Lower hand"
                        className="p-1.5 rounded-lg bg-amber-600/20 hover:bg-amber-600/40 text-amber-400 active:scale-95 transition-transform"
                      >
                        <Hand className="h-4 w-4" />
                      </button>
                    )}
                    {p.isMicrophoneEnabled === false ? (
                      <button
                        onClick={() => onUnmuteParticipant(p.identity)}
                        title="Allow to speak"
                        className="p-1.5 rounded-lg bg-green-600/20 hover:bg-green-600/40 text-green-400 active:scale-95 transition-transform"
                      >
                        <Mic className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => onMuteParticipant(p.identity)}
                        title="Mute"
                        className="p-1.5 rounded-lg bg-red-600/20 hover:bg-red-600/40 text-red-400 active:scale-95 transition-transform"
                      >
                        <MicOff className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
