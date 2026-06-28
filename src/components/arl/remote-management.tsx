"use client";

import { useState } from "react";
import { Monitor, Eye, LogIn } from "@/lib/icons";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
          <h2 className="text-lg font-semibold text-foreground">Remote Management</h2>
          <p className="text-xs text-muted-foreground">View, control, and manage remote sessions</p>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={(d) => setActiveTab(d.value as RemoteTab)} className="mb-4 shrink-0">
        <TabsList>
          <TabsTrigger value="view" className="flex items-center gap-1.5">
            <Eye className="h-3.5 w-3.5" /> View & Control
          </TabsTrigger>
          <TabsTrigger value="login" className="flex items-center gap-1.5">
            <LogIn className="h-3.5 w-3.5" /> Remote Login
          </TabsTrigger>
        </TabsList>
      </Tabs>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        {activeTab === "view" && <RemoteViewer userRole={userRole} />}
        {activeTab === "login" && <RemoteLogin />}
      </div>
    </div>
  );
}
