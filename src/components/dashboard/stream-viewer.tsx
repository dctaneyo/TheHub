"use client";

import { MeetingRoom } from "@/components/meeting-room";

interface StreamViewerProps {
  broadcastId: string;
  arlName: string;
  title: string;
  onClose: () => void;
}

export function StreamViewer({ broadcastId, arlName, title, onClose }: StreamViewerProps) {
  // The StreamViewer now delegates entirely to MeetingRoom.
  // Restaurants join as participants (audio-only, no video).
  // ARLs joining another ARL's meeting join as co-hosts (video+audio).
  return (
    <MeetingRoom
      meetingId={broadcastId}
      title={title || `${arlName}'s Meeting`}
      isHost={false}
      onLeave={onClose}
    />
  );
}
