"use client";

import { Messaging } from "@/components/arl/messaging";

export default function MessagesPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overscroll-contain p-4">
      <Messaging />
    </div>
  );
}
