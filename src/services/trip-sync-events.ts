type TripSyncListener = () => void;

const listeners = new Map<string, Set<TripSyncListener>>();

export function subscribeTripDataUpdated(
  tripId: string,
  listener: TripSyncListener,
) {
  if (!listeners.has(tripId)) {
    listeners.set(tripId, new Set());
  }

  listeners.get(tripId)!.add(listener);

  return () => {
    listeners.get(tripId)?.delete(listener);
  };
}

export function notifyTripDataUpdated(tripId: string) {
  listeners.get(tripId)?.forEach((listener) => listener());
}
