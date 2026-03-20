"use client";

import { FormsRepository } from "@/components/arl/forms-repository";

export default function FormsPage() {
  return (
    <div className="flex-1 overflow-y-auto overscroll-contain p-4">
      <FormsRepository />
    </div>
  );
}
