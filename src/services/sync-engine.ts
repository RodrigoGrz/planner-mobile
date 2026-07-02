import {
  getStoredActivityRemoteId,
  markActivitySyncFailed,
  markActivitySyncing,
  resetActivitySyncStatus,
  updateActivityRemoteIdAfterSync,
} from "@/repositories/activity-repository";
import {
  getStoredLinkRemoteId,
  markLinkSyncFailed,
  markLinkSyncing,
  resetLinkSyncStatus,
  updateLinkRemoteIdAfterSync,
} from "@/repositories/link-repository";
import {
  countActiveQueueItems,
  countFailedQueueItems,
  countPendingQueueItems,
  countSyncingQueueItems,
  getQueueItemsOrdered,
  markQueueItemFailed,
  markQueueItemSyncing,
  removeQueueItems,
  resetFailedQueueItems,
  resetStaleSyncingItems,
} from "@/repositories/sync-queue-repository";
import {
  getStoredRemoteId,
  isTripAvailableForChildSync,
  markTripImageSyncFailed,
  markTripSyncFailed,
  markTripSyncing,
  overwriteTripFromServer,
  resetTripSyncStatus,
  resolveLocalTripId,
  resolveRemoteId,
  updateTripRemoteIdAfterSync,
} from "@/repositories/trip-repository";
import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { tripServer } from "@/server/trip-server";
import { coalesceQueueItems } from "@/services/queue-coalescer";
import {
  syncActivities,
  syncTravelerTrips,
  syncTripDetail,
  syncTripDetails,
} from "@/services/sync-service";
import { notifyTripDataUpdated } from "@/services/trip-sync-events";
import {
  ActivityCreatePayload,
  CoalescedQueueItem,
  LinkCreatePayload,
  TripCreatePayload,
  TripImagePayload,
  TripUpdatePayload,
} from "@/types/sync";
import { logger } from "@/utils/logger";
import { isAxiosError } from "axios";

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;

let isSyncing = false;
const syncStatusListeners = new Set<() => void>();
const syncCompleteListeners = new Set<() => void>();

function notifySyncStatusChange() {
  syncStatusListeners.forEach((listener) => listener());
}

function notifySyncComplete() {
  syncCompleteListeners.forEach((listener) => listener());
}

export function subscribeSyncStatus(listener: () => void) {
  syncStatusListeners.add(listener);
  return () => {
    syncStatusListeners.delete(listener);
  };
}

export function subscribeSyncComplete(listener: () => void) {
  syncCompleteListeners.add(listener);
  return () => {
    syncCompleteListeners.delete(listener);
  };
}

export function getIsSyncing() {
  return isSyncing;
}

export async function getSyncCounts() {
  const [pendingCount, failedCount, syncingCount] = await Promise.all([
    countPendingQueueItems(),
    countFailedQueueItems(),
    countSyncingQueueItems(),
  ]);

  return { pendingCount, failedCount, syncingCount };
}

function getRetryDelay(retryCount: number) {
  return BASE_RETRY_DELAY_MS * 2 ** retryCount;
}

function getNextRetryAt(retryCount: number) {
  return new Date(Date.now() + getRetryDelay(retryCount)).toISOString();
}

function getErrorMessage(error: unknown) {
  if (isAxiosError(error)) {
    if (error.response?.status === 401) {
      return "AUTH_ERROR";
    }

    const message = error.response?.data?.message;
    if (typeof message === "string") {
      return message;
    }

    return error.message;
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Unknown synchronization error";
}

async function isItemReady(item: CoalescedQueueItem) {
  if (item.entityType === "activity" || item.entityType === "link") {
    const payload = item.payload as ActivityCreatePayload | LinkCreatePayload;
    return isTripAvailableForChildSync(payload.tripId);
  }

  if (item.entityType === "trip_image") {
    const payload = item.payload as TripImagePayload;
    return isTripAvailableForChildSync(payload.tripId);
  }

  if (item.dependsOnEntityId) {
    return isTripAvailableForChildSync(item.dependsOnEntityId);
  }

  return true;
}

async function processTripCreate(item: CoalescedQueueItem) {
  const existingRemoteId = await getStoredRemoteId(item.entityId);
  if (existingRemoteId) {
    return;
  }

  const payload = item.payload as TripCreatePayload;

  await markTripSyncing(item.entityId);

  const response = await tripServer.create({
    destination: payload.destination,
    startsAt: payload.startsAt,
    endsAt: payload.endsAt,
    emails_to_invite: payload.emailsToInvite,
  });

  await updateTripRemoteIdAfterSync(item.entityId, response.tripId);
  notifyTripDataUpdated(item.entityId);
  notifyTripDataUpdated(response.tripId);
}

async function processTripUpdate(item: CoalescedQueueItem) {
  const payload = item.payload as TripUpdatePayload;
  const remoteTripId = await resolveRemoteId(item.entityId);

  await markTripSyncing(item.entityId);

  try {
    await tripServer.update({
      tripId: remoteTripId,
      destination: payload.destination,
      startsAt: payload.startsAt,
      endsAt: payload.endsAt,
    });

    await updateTripRemoteIdAfterSync(item.entityId, remoteTripId);
    notifyTripDataUpdated(item.entityId);
  } catch (error) {
    if (isAxiosError(error) && error.response?.status === 409) {
      const serverTrip = await tripServer.getById(remoteTripId);
      await overwriteTripFromServer(serverTrip);
      notifyTripDataUpdated(item.entityId);
      return;
    }

    throw error;
  }
}

async function processActivityCreate(item: CoalescedQueueItem) {
  const existingRemoteId = await getStoredActivityRemoteId(item.entityId);
  if (existingRemoteId) {
    return;
  }

  const payload = item.payload as ActivityCreatePayload;
  const remoteTripId = await resolveRemoteId(payload.tripId);

  await markActivitySyncing(item.entityId);

  const response = await activitiesServer.create({
    tripId: remoteTripId,
    title: payload.title,
    occursAt: payload.occursAt,
  });

  await updateActivityRemoteIdAfterSync(item.entityId, response.activityId);
  notifyTripDataUpdated(payload.tripId);
}

async function processLinkCreate(item: CoalescedQueueItem) {
  const existingRemoteId = await getStoredLinkRemoteId(item.entityId);
  if (existingRemoteId) {
    return;
  }

  const payload = item.payload as LinkCreatePayload;
  const remoteTripId = await resolveRemoteId(payload.tripId);

  await markLinkSyncing(item.entityId);

  const response = await linksServer.create({
    tripId: remoteTripId,
    title: payload.title,
    url: payload.url,
  });

  await updateLinkRemoteIdAfterSync(item.entityId, response.linkId);
  notifyTripDataUpdated(payload.tripId);
}

async function processTripImage(item: CoalescedQueueItem) {
  const payload = item.payload as TripImagePayload;
  const remoteTripId = await resolveRemoteId(payload.tripId);

  await tripServer.uploadTripImage(remoteTripId, payload.coverImageUri);
  notifyTripDataUpdated(payload.tripId);
}

async function processCoalescedItem(item: CoalescedQueueItem) {
  switch (item.entityType) {
    case "trip":
      if (item.operation === "create") {
        await processTripCreate(item);
      } else {
        await processTripUpdate(item);
      }
      break;
    case "activity":
      await processActivityCreate(item);
      break;
    case "link":
      await processLinkCreate(item);
      break;
    case "trip_image":
      await processTripImage(item);
      break;
  }
}

async function markEntityFailed(item: CoalescedQueueItem, errorMessage: string) {
  switch (item.entityType) {
    case "trip":
      await markTripSyncFailed(item.entityId, errorMessage);
      break;
    case "activity":
      await markActivitySyncFailed(item.entityId, errorMessage);
      break;
    case "link":
      await markLinkSyncFailed(item.entityId, errorMessage);
      break;
    case "trip_image": {
      const payload = item.payload as TripImagePayload;
      await markTripImageSyncFailed(payload.tripId, errorMessage);
      break;
    }
  }
}

async function resetEntityStatusToPending(item: CoalescedQueueItem) {
  switch (item.entityType) {
    case "trip":
      await resetTripSyncStatus(item.entityId, "pending");
      break;
    case "activity":
      await resetActivitySyncStatus(item.entityId, "pending");
      break;
    case "link":
      await resetLinkSyncStatus(item.entityId, "pending");
      break;
  }
}

async function pullSyncAfterPush() {
  await syncTravelerTrips();
}

const tripPullInFlight = new Map<string, Promise<void>>();
const tripPullScheduled = new Set<string>();

async function executePullSyncTripData(tripId: string) {
  const results = await Promise.allSettled([
    syncTripDetail(tripId),
    syncActivities(tripId),
    syncTripDetails(tripId),
  ]);

  const labels = ["trip detail", "activities", "links/participants"] as const;

  results.forEach((result, index) => {
    if (result.status === "rejected") {
      logger.warn(`Pull sync failed (${labels[index]}):`, result.reason);
    }
  });

  const [localTripId, remoteTripId] = await Promise.all([
    resolveLocalTripId(tripId),
    resolveRemoteId(tripId),
  ]);

  for (const id of new Set([tripId, localTripId, remoteTripId])) {
    notifyTripDataUpdated(id);
  }
}

export async function pullSyncTripData(tripId: string) {
  const pullKey = await resolveLocalTripId(tripId);

  if (tripPullInFlight.has(pullKey)) {
    tripPullScheduled.add(pullKey);
    await tripPullInFlight.get(pullKey);

    if (tripPullScheduled.has(pullKey)) {
      tripPullScheduled.delete(pullKey);
      return pullSyncTripData(tripId);
    }

    return;
  }

  const pullPromise = executePullSyncTripData(tripId).finally(() => {
    tripPullInFlight.delete(pullKey);
  });

  tripPullInFlight.set(pullKey, pullPromise);
  await pullPromise;

  if (tripPullScheduled.has(pullKey)) {
    tripPullScheduled.delete(pullKey);
    return pullSyncTripData(tripId);
  }
}

export async function processSyncQueue() {
  if (isSyncing) {
    return;
  }

  isSyncing = true;
  notifySyncStatusChange();

  try {
    await resetStaleSyncingItems();

    let queueItems = await getQueueItemsOrdered();

    while (queueItems.length > 0) {
      const coalescedItems = coalesceQueueItems(queueItems);
      let progressed = false;

      for (const item of coalescedItems) {
        if (!(await isItemReady(item))) {
          continue;
        }

        for (const queueId of item.sourceQueueIds) {
          await markQueueItemSyncing(queueId);
        }

        try {
          await processCoalescedItem(item);
          await removeQueueItems(item.sourceQueueIds);
          progressed = true;
        } catch (error) {
          const errorMessage = getErrorMessage(error);

          if (errorMessage === "AUTH_ERROR") {
            for (const queueId of item.sourceQueueIds) {
              const queueItem = queueItems.find((entry) => entry.id === queueId);
              const retryCount = (queueItem?.retryCount ?? 0) + 1;
              await markQueueItemFailed(queueId, errorMessage, retryCount, null);
            }

            await markEntityFailed(item, errorMessage);
            return;
          }

          for (const queueId of item.sourceQueueIds) {
            const queueItem = queueItems.find((entry) => entry.id === queueId);
            const retryCount = (queueItem?.retryCount ?? 0) + 1;

            if (retryCount >= MAX_RETRIES) {
              await markQueueItemFailed(queueId, errorMessage, retryCount, null);
              await markEntityFailed(item, errorMessage);
            } else {
              await markQueueItemFailed(
                queueId,
                errorMessage,
                retryCount,
                getNextRetryAt(retryCount),
              );
              await resetEntityStatusToPending(item);
            }
          }
        }
      }

      if (!progressed) {
        break;
      }

      queueItems = await getQueueItemsOrdered();
    }

    if ((await countActiveQueueItems()) === 0) {
      try {
        await pullSyncAfterPush();
      } catch (error) {
        logger.warn("Pull sync after push failed:", error);
      }
    }
  } finally {
    isSyncing = false;
    notifySyncStatusChange();
    notifySyncComplete();
  }
}

export async function retryFailedSync() {
  const db = await import("@/database/database").then((m) => m.getDatabase());

  await resetFailedQueueItems();

  await db.runAsync(
    "UPDATE trips SET sync_status = 'pending', last_sync_error = NULL WHERE sync_status = 'failed'",
  );
  await db.runAsync(
    "UPDATE activities SET sync_status = 'pending', last_sync_error = NULL WHERE sync_status = 'failed'",
  );
  await db.runAsync(
    "UPDATE links SET sync_status = 'pending', last_sync_error = NULL WHERE sync_status = 'failed'",
  );

  notifySyncStatusChange();
  await processSyncQueue();
}

export async function runInitialSyncIfOnline(isOnline: boolean) {
  if (isOnline) {
    await processSyncQueue();
  }
}

export async function runSyncOnReconnect(isOnline: boolean) {
  if (isOnline) {
    await processSyncQueue();
  }
}
