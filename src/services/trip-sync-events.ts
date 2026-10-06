type TripSyncListener = () => void;

const listeners = new Map<string, Set<TripSyncListener>>();
const pendingTripIds = new Set<string>();
let flushScheduled = false;

function flushNotifications() {
  flushScheduled = false;
  const tripIds = Array.from(pendingTripIds);
  pendingTripIds.clear();

  for (const tripId of tripIds) {
    listeners.get(tripId)?.forEach((listener) => listener());
  }
}

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
  pendingTripIds.add(tripId);

  if (!flushScheduled) {
    flushScheduled = true;
    queueMicrotask(flushNotifications);
  }
}

const removalListeners = new Map<string, Set<TripSyncListener>>();

export function subscribeTripRemoved(
  tripId: string,
  listener: TripSyncListener,
) {
  if (!removalListeners.has(tripId)) {
    removalListeners.set(tripId, new Set());
  }

  removalListeners.get(tripId)!.add(listener);

  return () => {
    removalListeners.get(tripId)?.delete(listener);
  };
}

export function notifyTripRemoved(tripIds: string[]) {
  for (const tripId of new Set(tripIds)) {
    removalListeners.get(tripId)?.forEach((listener) => listener());
  }
}
