import { hasSynced } from "@/database/has-synced";
import { useIsOnlineRef } from "@/hooks/useIsOnlineRef";
import {
  getNextTrip,
  getTravelerTrips,
} from "@/repositories/trip-repository";
import { syncTravelerTrips } from "@/services/sync-service";
import { TripDetails } from "@/server/trip-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";
import { useSyncOnReconnect } from "./useSyncOnReconnect";

export function useTrips() {
  const isOnlineRef = useIsOnlineRef();
  const [trips, setTrips] = useState<TripDetails[]>([]);
  const [nextTrip, setNextTrip] = useState<TripDetails | null>(null);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    const [localTrips, localNextTrip, synced] = await Promise.all([
      getTravelerTrips(),
      getNextTrip(),
      hasSynced("trips_list"),
    ]);

    setTrips(localTrips);
    setNextTrip(localNextTrip);
    hasCacheRef.current = synced;

    return synced;
  }, []);

  const syncFromApi = useCallback(async () => {
    try {
      setStatus(hasCacheRef.current ? "syncing" : "loading");
      await syncTravelerTrips();
      await loadLocal();
      setStatus("ready");
    } catch {
      setStatus(hasCacheRef.current ? "offline" : "error");
    }
  }, [loadLocal]);

  const refresh = useCallback(async () => {
    const hasCache = await loadLocal();

    if (!isOnlineRef.current && hasCache) {
      setStatus("offline");
      return;
    }

    await syncFromApi();
  }, [isOnlineRef, loadLocal, syncFromApi]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useSyncOnReconnect(syncFromApi);

  return { trips, nextTrip, status, refresh };
}
