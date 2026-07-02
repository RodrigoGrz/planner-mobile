import { useAuth } from "@/hooks/useAuth";
import { useNetwork } from "@/contexts/NetworkContext";
import {
  getIsSyncing,
  getSyncCounts,
  retryFailedSync,
  runInitialSyncIfOnline,
  runSyncOnReconnect,
  subscribeSyncStatus,
} from "@/services/sync-engine";
import { setMutationOnlineChecker } from "@/services/mutation-service";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type SyncContextData = {
  pendingCount: number;
  failedCount: number;
  syncingCount: number;
  isSyncing: boolean;
  retryFailed: () => Promise<void>;
  refreshCounts: () => Promise<void>;
};

const SyncContext = createContext<SyncContextData>({} as SyncContextData);

type SyncProviderProps = {
  children: ReactNode;
};

export function SyncProvider({ children }: SyncProviderProps) {
  const { user } = useAuth();
  const { isOnline, registerReconnectCallback } = useNetwork();
  const [pendingCount, setPendingCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);
  const [syncingCount, setSyncingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const lastSyncedUserId = useRef<string | null>(null);

  const refreshCounts = useCallback(async () => {
    const counts = await getSyncCounts();
    setPendingCount(counts.pendingCount);
    setFailedCount(counts.failedCount);
    setSyncingCount(counts.syncingCount);
    setIsSyncing(getIsSyncing());
  }, []);

  const runSync = useCallback(async () => {
    await runInitialSyncIfOnline(isOnline);
    await refreshCounts();
  }, [isOnline, refreshCounts]);

  useEffect(() => {
    setMutationOnlineChecker(() => isOnline);
  }, [isOnline]);

  useEffect(() => {
    refreshCounts();
    return subscribeSyncStatus(() => {
      void refreshCounts();
    });
  }, [refreshCounts]);

  useEffect(() => {
    if (!user || !isOnline) {
      if (!user) {
        lastSyncedUserId.current = null;
      }
      return;
    }

    if (lastSyncedUserId.current === user.id) {
      return;
    }

    lastSyncedUserId.current = user.id;
    void runSync();
  }, [user, isOnline, runSync]);

  useEffect(() => {
    return registerReconnectCallback(() => {
      if (!user) {
        return;
      }

      void runSyncOnReconnect(true).then(refreshCounts);
    });
  }, [registerReconnectCallback, refreshCounts, user]);

  const retryFailed = useCallback(async () => {
    await retryFailedSync();
    await refreshCounts();
  }, [refreshCounts]);

  return (
    <SyncContext.Provider
      value={{
        pendingCount,
        failedCount,
        syncingCount,
        isSyncing,
        retryFailed,
        refreshCounts,
      }}
    >
      {children}
    </SyncContext.Provider>
  );
}

export function useSync() {
  return useContext(SyncContext);
}
