"use client";

import { ArlCalendar } from "@/components/arl/arl-calendar";

export default function CalendarPage() {
  return (
    <div className="flex flex-col flex-1 min-h-0 overscroll-contain p-4">
      <ArlCalendar />
    </div>
  );
}
