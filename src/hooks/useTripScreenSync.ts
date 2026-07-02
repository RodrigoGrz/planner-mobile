import { useNetwork } from "@/contexts/NetworkContext";
import { pullSyncTripData, subscribeSyncComplete } from "@/services/sync-engine";
import { useCallback, useEffect, useRef } from "react";

export function useTripScreenSync(tripId: string | undefined) {
  const { isOnline, reconnectSignal } = useNetwork();
  const lastReconnectSignalRef = useRef(reconnectSignal);

  const pullTripData = useCallback(async () => {
    if (!tripId) {
      return;
    }

    await pullSyncTripData(tripId);
  }, [tripId]);

  useEffect(() => {
    lastReconnectSignalRef.current = reconnectSignal;

    if (!tripId || !isOnline) {
      return;
    }

    void pullTripData();
  }, [tripId, isOnline, reconnectSignal, pullTripData]);

  useEffect(() => {
    if (!tripId) {
      return;
    }

    return subscribeSyncComplete(() => {
      void pullTripData();
    });
  }, [tripId, pullTripData]);
}
