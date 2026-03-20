"use client";

import { RemoteManagement } from "@/components/arl/remote-management";
import { useAuth } from "@/lib/auth-context";

export default function RemotePage() {
  const { user } = useAuth();
  return (
    <div className="flex flex-col flex-1 min-h-0 overscroll-contain p-4">
      <RemoteManagement userRole={user?.role} />
    </div>
  );
}
