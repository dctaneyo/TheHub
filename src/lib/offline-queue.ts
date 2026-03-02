"use client";

/**
 * Offline Queue — IndexedDB-based queue for offline actions.
 * Stores task completions, messages, and other mutations when offline.
 * Syncs back to the server when connection is restored.
 */

const DB_NAME = "hub-offline-queue";
const DB_VERSION = 1;
const STORE_NAME = "pending-actions";
const CACHE_STORE = "cached-data";

export interface OfflineAction {
  id: string;
  type: "task-complete" | "message-send" | "task-uncomplete";
  payload: Record<string, unknown>;
  createdAt: string;
  retries: number;
  status: "pending" | "syncing" | "failed";
}

export interface CachedData {
  key: string;
  data: unknown;
  cachedAt: string;
  expiresAt: string;
}

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("status", "status", { unique: false });
        store.createIndex("type", "type", { unique: false });
        store.createIndex("createdAt", "createdAt", { unique: false });
      }
      if (!db.objectStoreNames.contains(CACHE_STORE)) {
        db.createObjectStore(CACHE_STORE, { keyPath: "key" });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Queue an action for later sync.
 */
export async function queueAction(action: Omit<OfflineAction, "retries" | "status">): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  store.add({ ...action, retries: 0, status: "pending" });
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get all pending actions.
 */
export async function getPendingActions(): Promise<OfflineAction[]> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("status");
  const request = index.getAll("pending");
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Get count of pending actions.
 */
export async function getPendingCount(): Promise<number> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readonly");
  const store = tx.objectStore(STORE_NAME);
  const index = store.index("status");
  const request = index.count("pending");
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

/**
 * Update action status.
 */
export async function updateActionStatus(id: string, status: OfflineAction["status"], retries?: number): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const getReq = store.get(id);

  return new Promise((resolve, reject) => {
    getReq.onsuccess = () => {
      const action = getReq.result;
      if (action) {
        action.status = status;
        if (retries !== undefined) action.retries = retries;
        store.put(action);
      }
      tx.oncomplete = () => resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Remove a completed action from the queue.
 */
export async function removeAction(id: string): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  tx.objectStore(STORE_NAME).delete(id);
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Clear all completed/failed actions.
 */
export async function clearCompletedActions(): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(STORE_NAME, "readwrite");
  const store = tx.objectStore(STORE_NAME);
  const request = store.getAll();

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const actions: OfflineAction[] = request.result;
      for (const action of actions) {
        if (action.status !== "pending") {
          store.delete(action.id);
        }
      }
      tx.oncomplete = () => resolve();
    };
    tx.onerror = () => reject(tx.error);
  });
}

// ── Cache helpers for offline data access ──

/**
 * Cache API response data for offline access.
 */
export async function cacheData(key: string, data: unknown, ttlMinutes = 60): Promise<void> {
  const db = await openDB();
  const tx = db.transaction(CACHE_STORE, "readwrite");
  const store = tx.objectStore(CACHE_STORE);

  const now = new Date();
  const expires = new Date(now.getTime() + ttlMinutes * 60 * 1000);

  store.put({
    key,
    data,
    cachedAt: now.toISOString(),
    expiresAt: expires.toISOString(),
  });

  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/**
 * Get cached data if not expired.
 */
export async function getCachedData<T>(key: string): Promise<T | null> {
  const db = await openDB();
  const tx = db.transaction(CACHE_STORE, "readonly");
  const store = tx.objectStore(CACHE_STORE);
  const request = store.get(key);

  return new Promise((resolve, reject) => {
    request.onsuccess = () => {
      const result = request.result as CachedData | undefined;
      if (!result) return resolve(null);
      if (new Date(result.expiresAt) < new Date()) return resolve(null);
      resolve(result.data as T);
    };
    request.onerror = () => reject(request.error);
  });
}
