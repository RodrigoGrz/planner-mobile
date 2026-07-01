import { hasSynced } from "@/database/has-synced";
import { useIsOnlineRef } from "@/hooks/useIsOnlineRef";
import {
  ActivitySection,
  getActivitiesByTripIdGrouped,
} from "@/repositories/activity-repository";
import { syncActivities } from "@/services/sync-service";
import { subscribeTripDataUpdated } from "@/services/trip-sync-events";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useActivities(tripId: string) {
  const isOnlineRef = useIsOnlineRef();
  const [sections, setSections] = useState<ActivitySection[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    const localSections = await getActivitiesByTripIdGrouped(tripId);
    setSections(localSections);
    hasCacheRef.current = await hasSynced(`activities:${tripId}`);
    return hasCacheRef.current;
  }, [tripId]);

  const syncFromApi = useCallback(async () => {
    try {
      setStatus(hasCacheRef.current ? "syncing" : "loading");
      await syncActivities(tripId);
      await loadLocal();
      setStatus("ready");
    } catch {
      setStatus(hasCacheRef.current ? "offline" : "error");
    }
  }, [tripId, loadLocal]);

  const refresh = useCallback(async () => {
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
    return subscribeTripDataUpdated(tripId, () => {
      void loadLocal();
    });
  }, [tripId, loadLocal]);

  return { sections, status, refresh };
}
