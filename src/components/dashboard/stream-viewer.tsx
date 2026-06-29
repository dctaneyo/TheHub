"use client";

import { MeetingRoomLiveKitCustom as MeetingRoom } from "@/components/meeting-room-livekit-custom";

interface StreamViewerProps {
  broadcastId: string;
  arlName: string;
  title: string;
  onClose: () => void;
}

export function StreamViewer({ broadcastId, arlName, title, onClose }: StreamViewerProps) {
  // The StreamViewer delegates entirely to MeetingRoom, always as a
  // passive viewer — never prompted for mic/camera, never granted
  // publish rights (ARL-AUDIT-PLAN.md's "Go Live broadcast bugs" finding:
  // every StreamViewer caller, restaurant or ARL watching another ARL's
  // broadcast, was previously a full two-way publishing peer at the
  // protocol level regardless of the UI never asking them to publish).
  return (
    <MeetingRoom
      meetingId={broadcastId}
      title={title || `${arlName}'s Meeting`}
      isHost={false}
      viewOnly
      onLeave={onClose}
    />
  );
}
