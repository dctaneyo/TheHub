"use client";

import { EmergencyBroadcast } from "@/components/arl/emergency-broadcast";

export default function EmergencyPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <EmergencyBroadcast />
    </div>
  );
}
