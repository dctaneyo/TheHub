"use client";

import { DashboardLayoutSettings } from "@/components/arl/dashboard-layout-settings";

export default function DashboardLayoutPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <DashboardLayoutSettings />
    </div>
  );
}
