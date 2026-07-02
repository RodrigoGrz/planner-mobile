import { useNetwork } from "@/contexts/NetworkContext";
import { useLoadGeneration } from "@/hooks/useLoadGeneration";
import { hasSynced } from "@/database/has-synced";
import { getLinksByTripId } from "@/repositories/link-repository";
import { getParticipantsByTripId } from "@/repositories/participant-repository";
import { subscribeTripDataUpdated } from "@/services/trip-sync-events";
import { Link } from "@/server/links-server";
import { Participant } from "@/server/participants-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useTripDetails(tripId: string) {
  const { isOnline } = useNetwork();
  const { beginLoad, isCurrentLoad } = useLoadGeneration();
  const [links, setLinks] = useState<Link[]>([]);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [status, setStatus] = useState<DataStatus>("loading");
  const hasCacheRef = useRef(false);

  const loadLocal = useCallback(async () => {
    const generation = beginLoad();
    const [localLinks, localParticipants, linksSynced, participantsSynced] =
      await Promise.all([
        getLinksByTripId(tripId),
        getParticipantsByTripId(tripId),
        hasSynced(`links:${tripId}`),
        hasSynced(`participants:${tripId}`),
      ]);

    const hasCache =
      linksSynced ||
      participantsSynced ||
      localLinks.length > 0 ||
      localParticipants.length > 0;

    if (!isCurrentLoad(generation)) {
      return { hasCache: hasCacheRef.current, stale: true };
    }

    setLinks(localLinks);
    setParticipants(localParticipants);
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

  return { links, participants, status, refresh };
}
