"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  queueAction,
  getPendingActions,
  getPendingCount,
  updateActionStatus,
  removeAction,
  cacheData,
  getCachedData,
  type OfflineAction,
} from "@/lib/offline-queue";
import { v4 as uuid } from "uuid";

interface UseOfflineSyncReturn {
  isOnline: boolean;
  pendingCount: number;
  isSyncing: boolean;
  /** Queue a task completion for sync */
  completeTaskOffline: (taskId: string, locationId: string, completedDate: string) => Promise<void>;
  /** Queue a task un-completion for sync */
  uncompleteTaskOffline: (taskId: string, locationId: string, completedDate: string) => Promise<void>;
  /** Queue a message send for sync */
  sendMessageOffline: (conversationId: string, content: string, senderType: string, senderId: string, senderName: string) => Promise<void>;
  /** Force sync now */
  syncNow: () => Promise<void>;
  /** Cache data for offline access */
  cacheForOffline: (key: string, data: unknown, ttlMinutes?: number) => Promise<void>;
  /** Get cached data */
  getOfflineCache: <T>(key: string) => Promise<T | null>;
}

const MAX_RETRIES = 3;
const SYNC_INTERVAL_MS = 30000; // 30 seconds

export function useOfflineSync(): UseOfflineSyncReturn {
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const syncTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  // Track online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  // Refresh pending count
  const refreshCount = useCallback(async () => {
    try {
      const count = await getPendingCount();
      setPendingCount(count);
    } catch {}
  }, []);

  // Sync pending actions to server
  const syncNow = useCallback(async () => {
    if (isSyncing || !navigator.onLine) return;
    setIsSyncing(true);

    try {
      const actions = await getPendingActions();
      for (const action of actions) {
        try {
          await updateActionStatus(action.id, "syncing");
          await syncAction(action);
          await removeAction(action.id);
        } catch (err) {
          console.warn(`Sync failed for action ${action.id}:`, err);
          const retries = action.retries + 1;
          if (retries >= MAX_RETRIES) {
            await updateActionStatus(action.id, "failed", retries);
          } else {
            await updateActionStatus(action.id, "pending", retries);
          }
        }
      }
    } catch (err) {
      console.error("Sync error:", err);
    } finally {
      setIsSyncing(false);
      await refreshCount();
    }
  }, [isSyncing, refreshCount]);

  // Auto-sync when coming back online
  useEffect(() => {
    if (isOnline && pendingCount > 0) {
      syncNow();
    }
  }, [isOnline, pendingCount, syncNow]);

  // Periodic sync check
  useEffect(() => {
    refreshCount();
    syncTimerRef.current = setInterval(() => {
      if (navigator.onLine) {
        refreshCount().then(() => {
          // syncNow is called via the isOnline + pendingCount effect
        });
      }
    }, SYNC_INTERVAL_MS);

    return () => {
      if (syncTimerRef.current) clearInterval(syncTimerRef.current);
    };
  }, [refreshCount]);

  const completeTaskOffline = useCallback(async (taskId: string, locationId: string, completedDate: string) => {
    await queueAction({
      id: uuid(),
      type: "task-complete",
      payload: { taskId, locationId, completedDate },
      createdAt: new Date().toISOString(),
    });
    await refreshCount();
  }, [refreshCount]);

  const uncompleteTaskOffline = useCallback(async (taskId: string, locationId: string, completedDate: string) => {
    await queueAction({
      id: uuid(),
      type: "task-uncomplete",
      payload: { taskId, locationId, completedDate },
      createdAt: new Date().toISOString(),
    });
    await refreshCount();
  }, [refreshCount]);

  const sendMessageOffline = useCallback(async (conversationId: string, content: string, senderType: string, senderId: string, senderName: string) => {
    await queueAction({
      id: uuid(),
      type: "message-send",
      payload: { conversationId, content, senderType, senderId, senderName },
      createdAt: new Date().toISOString(),
    });
    await refreshCount();
  }, [refreshCount]);

  return {
    isOnline,
    pendingCount,
    isSyncing,
    completeTaskOffline,
    uncompleteTaskOffline,
    sendMessageOffline,
    syncNow,
    cacheForOffline: cacheData,
    getOfflineCache: getCachedData,
  };
}

/**
 * Execute a single queued action against the server.
 */
async function syncAction(action: OfflineAction): Promise<void> {
  const headers: HeadersInit = {
    "Content-Type": "application/json",
    "x-hub-request": "1", // CSRF token
  };

  switch (action.type) {
    case "task-complete": {
      const { taskId, locationId, completedDate } = action.payload as {
        taskId: string; locationId: string; completedDate: string;
      };
      const res = await fetch("/api/tasks/complete", {
        method: "POST",
        headers,
        body: JSON.stringify({ taskId, locationId, completedDate }),
      });
      if (!res.ok) throw new Error(`Task complete failed: ${res.status}`);
      break;
    }
    case "task-uncomplete": {
      const { taskId, locationId, completedDate } = action.payload as {
        taskId: string; locationId: string; completedDate: string;
      };
      const res = await fetch("/api/tasks/complete", {
        method: "DELETE",
        headers,
        body: JSON.stringify({ taskId, locationId, completedDate }),
      });
      if (!res.ok) throw new Error(`Task uncomplete failed: ${res.status}`);
      break;
    }
    case "message-send": {
      const { conversationId, content } = action.payload as {
        conversationId: string; content: string;
      };
      const res = await fetch("/api/messages", {
        method: "POST",
        headers,
        body: JSON.stringify({ conversationId, content }),
      });
      if (!res.ok) throw new Error(`Message send failed: ${res.status}`);
      break;
    }
    default:
      console.warn(`Unknown action type: ${action.type}`);
  }
}
