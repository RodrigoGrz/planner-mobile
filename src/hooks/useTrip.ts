import { useNetwork } from "@/contexts/NetworkContext";
import { useLoadGeneration } from "@/hooks/useLoadGeneration";
import { hasSynced } from "@/database/has-synced";
import {
  getTripById,
  isTripInvitePending,
} from "@/repositories/trip-repository";
import {
  subscribeTripDataUpdated,
  subscribeTripRemoved,
} from "@/services/trip-sync-events";
import { TripByID } from "@/server/trip-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useTrip(tripId: string | undefined) {
  const { isOnline } = useNetwork();
  const { beginLoad, isCurrentLoad } = useLoadGeneration();
  const [trip, setTrip] = useState<TripByID | null>(null);
  const [status, setStatus] = useState<DataStatus>("loading");
  const [isRemoved, setIsRemoved] = useState(false);
  const [isInvitePending, setIsInvitePending] = useState(false);
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    if (!tripId) {
      return { hasCache: false, stale: false };
    }

    const generation = beginLoad();
    const [localTrip, synced, invitePending] = await Promise.all([
      getTripById(tripId),
      hasSynced(`trip:${tripId}`),
      isTripInvitePending(tripId),
    ]);
    const hasCache = synced || localTrip !== null;

    if (!isCurrentLoad(generation)) {
      return { hasCache: hasCacheRef.current, stale: true };
    }

    setTrip(localTrip);
    setIsInvitePending(invitePending);
    hasCacheRef.current = hasCache;

    return { hasCache, stale: false };
  }, [tripId, beginLoad, isCurrentLoad]);

  const refresh = useCallback(async () => {
    if (!tripId) {
      setStatus("error");
      return;
    }

    const { hasCache, stale } = await loadLocal();

    if (stale) {
      return;
    }

    if (!isOnline) {
      setStatus(hasCache ? "offline" : "error");
      return;
    }

    setStatus("ready");
  }, [tripId, isOnline, loadLocal]);

  useEffect(() => {
    void refresh();
  }, [tripId, refresh]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    return subscribeTripDataUpdated(tripId, () => {
      void refresh();
    });
  }, [tripId, refresh]);

  useEffect(() => {
    setIsRemoved(false);

    if (!tripId) {
      return;
    }

    return subscribeTripRemoved(tripId, () => {
      beginLoad();
      setTrip(null);
      setIsRemoved(true);
    });
  }, [tripId, beginLoad]);

  return { trip, status, refresh, isRemoved, isInvitePending };
}
