"use client";

import { TenantSettings } from "@/components/arl/tenant-settings";

export default function TenantSettingsPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <TenantSettings />
    </div>
  );
}
