import { hasSynced } from "@/database/has-synced";
import { useIsOnlineRef } from "@/hooks/useIsOnlineRef";
import { getLinksByTripId } from "@/repositories/link-repository";
import { getParticipantsByTripId } from "@/repositories/participant-repository";
import { syncTripDetails } from "@/services/sync-service";
import { subscribeTripDataUpdated } from "@/services/trip-sync-events";
import { Link } from "@/server/links-server";
import { Participant } from "@/server/participants-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useTripDetails(tripId: string) {
  const isOnlineRef = useIsOnlineRef();
  const [links, setLinks] = useState<Link[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    const [localLinks, localParticipants, linksSynced, participantsSynced] =
      await Promise.all([
        getLinksByTripId(tripId),
        getParticipantsByTripId(tripId),
        hasSynced(`links:${tripId}`),
        hasSynced(`participants:${tripId}`),
      ]);

    setLinks(localLinks);
    setParticipants(localParticipants);
    hasCacheRef.current = linksSynced || participantsSynced;

    return hasCacheRef.current;
  }, [tripId]);

  const syncFromApi = useCallback(async () => {
    try {
      setStatus(hasCacheRef.current ? "syncing" : "loading");
      await syncTripDetails(tripId);
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

  return { links, participants, status, refresh };
}
