import {
  syncActivities,
  syncTripDetail,
  syncTripDetails,
} from "@/services/sync-service";
import { notifyTripDataUpdated } from "@/services/trip-sync-events";
import { useCallback } from "react";
import { useSyncOnReconnect } from "./useSyncOnReconnect";

export function useTripScreenSync(tripId: string | undefined) {
  const syncAllTripData = useCallback(async () => {
    if (!tripId) {
      return;
    }

    await Promise.allSettled([
      syncTripDetail(tripId),
      syncActivities(tripId),
      syncTripDetails(tripId),
    ]);

    notifyTripDataUpdated(tripId);
  }, [tripId]);

  useSyncOnReconnect(syncAllTripData);
}
