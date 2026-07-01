import { hasSynced } from "@/database/has-synced";
import { useIsOnlineRef } from "@/hooks/useIsOnlineRef";
import { getTripById } from "@/repositories/trip-repository";
import { syncTripDetail } from "@/services/sync-service";
import { subscribeTripDataUpdated } from "@/services/trip-sync-events";
import { TripByID } from "@/server/trip-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useTrip(tripId: string | undefined) {
  const isOnlineRef = useIsOnlineRef();
  const [trip, setTrip] = useState<TripByID | null>(null);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    if (!tripId) {
      return false;
    }

    const [localTrip, synced] = await Promise.all([
      getTripById(tripId),
      hasSynced(`trip:${tripId}`),
    ]);

    setTrip(localTrip);
    hasCacheRef.current = synced || localTrip !== null;

    return hasCacheRef.current;
  }, [tripId]);

  const syncFromApi = useCallback(async () => {
    if (!tripId) {
      setStatus("error");
      return;
    }

    try {
      setStatus(hasCacheRef.current ? "syncing" : "loading");
      await syncTripDetail(tripId);
      await loadLocal();
      setStatus("ready");
    } catch {
      setStatus(hasCacheRef.current ? "offline" : "error");
    }
  }, [tripId, loadLocal]);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setStatus("error");
      return;
    }

    const hasCache = await loadLocal();

    if (!isOnlineRef.current && hasCache) {
      setStatus("offline");
      return;
    }

    await syncFromApi();
  }, [tripId, isOnlineRef, loadLocal, syncFromApi]);

  useEffect(() => {
    refresh();
  }, [tripId, refresh]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    return subscribeTripDataUpdated(tripId, () => {
      void loadLocal();
    });
  }, [tripId, loadLocal]);

  return { trip, status, refresh };
}
