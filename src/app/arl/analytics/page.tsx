"use client";

import { AnalyticsDashboard } from "@/components/arl/analytics-dashboard";

export default function AnalyticsPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <AnalyticsDashboard />
    </div>
  );
}
