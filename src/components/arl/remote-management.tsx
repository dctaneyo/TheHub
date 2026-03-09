"use client";

import { useState } from "react";
import { Monitor, Eye, LogIn } from "@/lib/icons";
import { cn } from "@/lib/utils";
import { RemoteLogin } from "./remote-login";
import { RemoteViewer } from "./remote-viewer";

type RemoteTab = "login" | "view";

interface RemoteManagementProps {
  userRole?: string; // "admin" | "arl" | etc
}

export function RemoteManagement({ userRole }: RemoteManagementProps) {
  const [activeTab, setActiveTab] = useState<RemoteTab>("view");

  return (
    <div className="flex flex-col h-full min-h-0">
      {/* Tab header */}
      <div className="flex items-center gap-2 mb-4 shrink-0">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-950">
          <Monitor className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
        </div>
        <div className="flex-1">
          <h2 className="text-lg font-bold text-foreground">Remote Management</h2>
          <p className="text-xs text-muted-foreground">View, control, and manage remote sessions</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-muted p-1 mb-4 shrink-0">
        <button
          onClick={() => setActiveTab("view")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all flex-1 justify-center",
            activeTab === "view"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <Eye className="h-4 w-4" />
          View & Control
        </button>
        <button
          onClick={() => setActiveTab("login")}
          className={cn(
            "flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all flex-1 justify-center",
            activeTab === "login"
              ? "bg-card text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          <LogIn className="h-4 w-4" />
          Remote Login
        </button>
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "view" && <RemoteViewer userRole={userRole} />}
        {activeTab === "login" && <RemoteLogin />}
      </div>
    </div>
  );
}
