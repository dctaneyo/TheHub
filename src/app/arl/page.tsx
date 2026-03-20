"use client";

import { OverviewDashboard } from "@/components/arl/overview-dashboard";

export default function OverviewPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <OverviewDashboard />
    </div>
  );
}
