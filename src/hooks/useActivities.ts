import { useNetwork } from "@/contexts/NetworkContext";
import { useLoadGeneration } from "@/hooks/useLoadGeneration";
import { hasSynced } from "@/database/has-synced";
import {
  ActivitySection,
  getActivitiesByTripIdGrouped,
} from "@/repositories/activity-repository";
import { subscribeTripDataUpdated } from "@/services/trip-sync-events";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useActivities(tripId: string) {
  const { isOnline } = useNetwork();
  const { beginLoad, isCurrentLoad } = useLoadGeneration();
  const [sections, setSections] = useState<ActivitySection[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    const generation = beginLoad();
    const localSections = await getActivitiesByTripIdGrouped(tripId);
    const synced = await hasSynced(`activities:${tripId}`);
    const hasCache =
      synced || localSections.some((section) => section.data.length > 0);

    if (!isCurrentLoad(generation)) {
      return { hasCache: hasCacheRef.current, stale: true };
    }

    setSections(localSections);
    hasCacheRef.current = hasCache;

    return { hasCache, stale: false };
  }, [tripId, beginLoad, isCurrentLoad]);

  const refresh = useCallback(async () => {
    const { hasCache, stale } = await loadLocal();

    if (stale) {
      return;
    }

    if (!isOnline) {
      setStatus(hasCache ? "offline" : "error");
      return;
    }

    if (!hasCache) {
      setStatus("syncing");
      return;
    }

    setStatus("ready");
  }, [isOnline, loadLocal]);

  useEffect(() => {
    void refresh();
  }, [tripId, refresh]);

  useEffect(() => {
    return subscribeTripDataUpdated(tripId, () => {
      void refresh();
    });
  }, [tripId, refresh]);

  return { sections, status, refresh };
}
