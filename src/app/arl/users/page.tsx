"use client";

import { UserManagement } from "@/components/arl/user-management";

export default function UsersPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <UserManagement />
    </div>
  );
}
