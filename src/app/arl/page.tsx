"use client";

import { OverviewDashboard } from "@/components/arl/overview-dashboard";

export default function OverviewPage() {
  return (
    // Desktop: fixed height, no page scroll — Overview owns a real
    // single-viewport "look once" layout internally (each panel scrolls
    // on its own). Mobile keeps natural scroll; two columns don't fit.
    <div className="flex-1 flex flex-col overflow-y-auto md:overflow-hidden overscroll-contain p-4">
      <OverviewDashboard />
    </div>
  );
}
