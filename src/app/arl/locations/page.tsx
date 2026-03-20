"use client";

import { LocationsManager } from "@/components/arl/locations-manager";

export default function LocationsPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <LocationsManager />
    </div>
  );
}
