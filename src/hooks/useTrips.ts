import { useNetwork } from "@/contexts/NetworkContext";
import { hasSynced } from "@/database/has-synced";
import {
  getNextTrip,
  getTravelerTrips,
} from "@/repositories/trip-repository";
import { subscribeSyncComplete } from "@/services/sync-engine";
import { TripDetails } from "@/server/trip-server";
import { DataStatus } from "@/types/data-status";
import { useCallback, useEffect, useRef, useState } from "react";

export function useTrips() {
  const { isOnline } = useNetwork();
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
    hasCacheRef.current = synced || localTrips.length > 0;

    return hasCacheRef.current;
  }, []);

  const refresh = useCallback(async () => {
    const hasCache = await loadLocal();

    if (!isOnline) {
      setStatus(hasCache ? "offline" : "error");
      return;
    }

    setStatus("ready");
  }, [isOnline, loadLocal]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  useEffect(() => {
    return subscribeSyncComplete(() => {
      void refresh();
    });
  }, [refresh]);

  return { trips, nextTrip, status, refresh };
}
