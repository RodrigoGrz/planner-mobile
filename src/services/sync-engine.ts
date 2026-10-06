import {
  getStoredActivityRemoteId,
  markActivitySyncedWithoutRemoteId,
  markActivitySyncFailed,
  markActivitySyncing,
  resetActivitySyncStatus,
  updateActivityRemoteIdAfterSync,
} from "@/repositories/activity-repository";
import {
  getStoredLinkRemoteId,
  markLinkSyncedWithoutRemoteId,
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
  removeTripLocally,
  resetTripSyncStatus,
  resolveLocalTripId,
  resolveRemoteId,
  updateTripRemoteIdAfterSync,
} from "@/repositories/trip-repository";
import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { tripServer } from "@/server/trip-server";
import { coalesceQueueItems } from "@/services/queue-coalescer";
import { classifySyncError } from "@/services/sync-error-classifier";
import {
  syncActivities,
  syncTravelerTrips,
  syncTripDetail,
  syncTripDetails,
} from "@/services/sync-service";
import {
  notifyTripDataUpdated,
  notifyTripRemoved,
} from "@/services/trip-sync-events";
import {
  ActivityCreatePayload,
  CoalescedQueueItem,
  LinkCreatePayload,
  SyncQueueItem,
  TripCreatePayload,
  TripImagePayload,
  TripUpdatePayload,
} from "@/types/sync";
import { ERROR_MESSAGES } from "@/utils/error-messages";
import { logger } from "@/utils/logger";

const MAX_RETRIES = 5;
const BASE_RETRY_DELAY_MS = 1000;
const TRIP_RELOAD_STATUSES = [403, 422];

type SyncFailureListener = (event: { message: string }) => void;

type ProcessResult = { rejectedMessage?: string } | undefined;

type FailureOutcome = "stop" | "progressed" | "pending";

let isSyncing = false;
let queueRunTimer: ReturnType<typeof setTimeout> | null = null;
const syncStatusListeners = new Set<() => void>();
const syncCompleteListeners = new Set<() => void>();
const syncFailureListeners = new Set<SyncFailureListener>();

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

export function subscribeSyncFailure(listener: SyncFailureListener) {
  syncFailureListeners.add(listener);
  return () => {
    syncFailureListeners.delete(listener);
  };
}

function notifySyncFailures(messages: string[]) {
  if (messages.length === 0) {
    return;
  }

  const message =
    messages.length === 1
      ? messages[0]
      : ERROR_MESSAGES.syncFailures(messages.length);

  syncFailureListeners.forEach((listener) => listener({ message }));
}

function scheduleQueueRun(delayMs: number) {
  if (queueRunTimer) {
    clearTimeout(queueRunTimer);
  }

  queueRunTimer = setTimeout(() => {
    queueRunTimer = null;

    if (isSyncing) {
      scheduleQueueRun(BASE_RETRY_DELAY_MS);
      return;
    }

    void processSyncQueue();
  }, delayMs);
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

function getRetryAtAfter(delayMs: number) {
  return new Date(Date.now() + delayMs).toISOString();
}

function getNextRetryAt(retryCount: number) {
  return getRetryAtAfter(getRetryDelay(retryCount));
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

async function processTripUpdate(
  item: CoalescedQueueItem,
): Promise<ProcessResult> {
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
    const classification = classifySyncError(error);

    if (
      classification.kind !== "permanent" ||
      !TRIP_RELOAD_STATUSES.includes(classification.status ?? 0)
    ) {
      throw error;
    }

    try {
      const serverTrip = await tripServer.getById(remoteTripId);
      await overwriteTripFromServer(serverTrip);
    } catch (reloadError) {
      logger.warn("Reload trip after rejected update failed:", reloadError);
      throw error;
    }

    notifyTripDataUpdated(item.entityId);
    return { rejectedMessage: classification.message };
  }
}

function getItemTripId(item: CoalescedQueueItem) {
  if (item.entityType === "trip") {
    return item.entityId;
  }

  return (item.payload as { tripId: string }).tripId;
}

async function removeGoneTrip(item: CoalescedQueueItem) {
  const tripId = getItemTripId(item);
  const localTripId = await resolveLocalTripId(tripId);

  if (!(await getStoredRemoteId(localTripId))) {
    return false;
  }

  const removedTripIds = await removeTripLocally(tripId);
  notifyTripRemoved(removedTripIds);
  removedTripIds.forEach(notifyTripDataUpdated);

  return true;
}

function reconcileTripAfterMissingId(
  entityType: "activity" | "link",
  tripId: string,
) {
  logger.warn(`Create ${entityType} response without id; pulling trip ${tripId}`);
  void pullSyncTripData(tripId).catch((error) => {
    logger.warn("Pull sync after missing id failed:", error);
  });
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

  if (response.activityId) {
    await updateActivityRemoteIdAfterSync(item.entityId, response.activityId);
  } else {
    await markActivitySyncedWithoutRemoteId(item.entityId);
    reconcileTripAfterMissingId("activity", payload.tripId);
  }

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

  if (response.linkId) {
    await updateLinkRemoteIdAfterSync(item.entityId, response.linkId);
  } else {
    await markLinkSyncedWithoutRemoteId(item.entityId);
    reconcileTripAfterMissingId("link", payload.tripId);
  }

  notifyTripDataUpdated(payload.tripId);
}

async function processTripImage(item: CoalescedQueueItem) {
  const payload = item.payload as TripImagePayload;
  const remoteTripId = await resolveRemoteId(payload.tripId);

  await tripServer.uploadTripImage(remoteTripId, payload.coverImageUri);
  notifyTripDataUpdated(payload.tripId);
}

async function processCoalescedItem(
  item: CoalescedQueueItem,
): Promise<ProcessResult> {
  switch (item.entityType) {
    case "trip":
      if (item.operation === "create") {
        await processTripCreate(item);
        break;
      }
      return processTripUpdate(item);
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

function getPreviousRetryCount(queueItems: SyncQueueItem[], queueId: string) {
  return queueItems.find((entry) => entry.id === queueId)?.retryCount ?? 0;
}

async function handleItemFailure(
  item: CoalescedQueueItem,
  error: unknown,
  queueItems: SyncQueueItem[],
  failureMessages: string[],
): Promise<FailureOutcome> {
  const classification = classifySyncError(error);
  logger.warn(`Sync ${item.entityType} ${item.operation} failed:`, error);

  if (classification.kind === "auth") {
    for (const queueId of item.sourceQueueIds) {
      await markQueueItemFailed(
        queueId,
        classification.message,
        getPreviousRetryCount(queueItems, queueId) + 1,
        null,
      );
    }

    await markEntityFailed(item, classification.message);
    return "stop";
  }

  if (classification.kind === "not_found" && (await removeGoneTrip(item))) {
    failureMessages.push(ERROR_MESSAGES.tripGone);
    return "progressed";
  }

  if (classification.kind === "rate_limited") {
    const retryCounts = item.sourceQueueIds.map((queueId) =>
      getPreviousRetryCount(queueItems, queueId),
    );
    const delayMs = Math.max(
      classification.retryAfterMs ?? getRetryDelay(Math.max(...retryCounts)),
      BASE_RETRY_DELAY_MS,
    );
    const retryAt = getRetryAtAfter(delayMs);

    for (const [index, queueId] of item.sourceQueueIds.entries()) {
      await markQueueItemFailed(
        queueId,
        classification.message,
        retryCounts[index],
        retryAt,
      );
    }

    await resetEntityStatusToPending(item);
    scheduleQueueRun(delayMs);
    return "stop";
  }

  let failedForGood = false;

  for (const queueId of item.sourceQueueIds) {
    const retryCount = getPreviousRetryCount(queueItems, queueId) + 1;
    const exhausted =
      classification.kind !== "retryable" || retryCount >= MAX_RETRIES;

    failedForGood ||= exhausted;
    await markQueueItemFailed(
      queueId,
      classification.message,
      retryCount,
      exhausted ? null : getNextRetryAt(retryCount),
    );
  }

  if (failedForGood) {
    await markEntityFailed(item, classification.message);
    failureMessages.push(classification.message);
  } else {
    await resetEntityStatusToPending(item);
  }

  return "pending";
}

export async function processSyncQueue() {
  if (isSyncing) {
    return;
  }

  isSyncing = true;
  notifySyncStatusChange();

  const failureMessages: string[] = [];

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
          const result = await processCoalescedItem(item);
          await removeQueueItems(item.sourceQueueIds);

          if (result?.rejectedMessage) {
            failureMessages.push(result.rejectedMessage);
          }

          progressed = true;
        } catch (error) {
          const outcome = await handleItemFailure(
            item,
            error,
            queueItems,
            failureMessages,
          );

          if (outcome === "stop") {
            return;
          }

          if (outcome === "progressed") {
            progressed = true;
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
    notifySyncFailures(failureMessages);
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
