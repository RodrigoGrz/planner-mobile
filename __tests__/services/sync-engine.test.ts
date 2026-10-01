import {
  markActivitySyncedWithoutRemoteId,
  markActivitySyncFailed,
  updateActivityRemoteIdAfterSync,
} from "@/repositories/activity-repository";
import {
  markLinkSyncedWithoutRemoteId,
  updateLinkRemoteIdAfterSync,
} from "@/repositories/link-repository";
import {
  getQueueItemsOrdered,
  markQueueItemFailed,
  removeQueueItems,
} from "@/repositories/sync-queue-repository";
import { overwriteTripFromServer } from "@/repositories/trip-repository";
import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { tripServer } from "@/server/trip-server";
import { processSyncQueue } from "@/services/sync-engine";
import { syncActivities } from "@/services/sync-service";
import { notifyTripDataUpdated } from "@/services/trip-sync-events";
import { SyncQueueItem } from "@/types/sync";
import { AppError } from "@/utils/app-error";

jest.mock("@/repositories/activity-repository", () => ({
  getStoredActivityRemoteId: jest.fn(() => Promise.resolve(null)),
  markActivitySyncFailed: jest.fn(),
  markActivitySyncing: jest.fn(),
  markActivitySyncedWithoutRemoteId: jest.fn(),
  resetActivitySyncStatus: jest.fn(),
  updateActivityRemoteIdAfterSync: jest.fn(),
}));

jest.mock("@/repositories/link-repository", () => ({
  getStoredLinkRemoteId: jest.fn(() => Promise.resolve(null)),
  markLinkSyncFailed: jest.fn(),
  markLinkSyncing: jest.fn(),
  markLinkSyncedWithoutRemoteId: jest.fn(),
  resetLinkSyncStatus: jest.fn(),
  updateLinkRemoteIdAfterSync: jest.fn(),
}));

jest.mock("@/repositories/sync-queue-repository", () => ({
  countActiveQueueItems: jest.fn(() => Promise.resolve(0)),
  countFailedQueueItems: jest.fn(),
  countPendingQueueItems: jest.fn(),
  countSyncingQueueItems: jest.fn(),
  getQueueItemsOrdered: jest.fn(),
  markQueueItemFailed: jest.fn(),
  markQueueItemSyncing: jest.fn(),
  removeQueueItems: jest.fn(),
  resetFailedQueueItems: jest.fn(),
  resetStaleSyncingItems: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  getStoredRemoteId: jest.fn(),
  isTripAvailableForChildSync: jest.fn(() => Promise.resolve(true)),
  markTripImageSyncFailed: jest.fn(),
  markTripSyncFailed: jest.fn(),
  markTripSyncing: jest.fn(),
  overwriteTripFromServer: jest.fn(),
  resetTripSyncStatus: jest.fn(),
  resolveLocalTripId: jest.fn((tripId: string) => Promise.resolve(tripId)),
  resolveRemoteId: jest.fn(() => Promise.resolve("trip-remote-1")),
  updateTripRemoteIdAfterSync: jest.fn(),
}));

jest.mock("@/server/activities-server", () => ({
  activitiesServer: { create: jest.fn() },
}));

jest.mock("@/server/links-server", () => ({
  linksServer: { create: jest.fn() },
}));

jest.mock("@/server/trip-server", () => ({
  tripServer: {
    update: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock("@/services/sync-service", () => ({
  syncActivities: jest.fn(() => Promise.resolve()),
  syncTravelerTrips: jest.fn(() => Promise.resolve()),
  syncTripDetail: jest.fn(() => Promise.resolve()),
  syncTripDetails: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/services/trip-sync-events", () => ({
  notifyTripDataUpdated: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

function makeQueueItem(override: Partial<SyncQueueItem>): SyncQueueItem {
  return {
    id: "queue-1",
    entityType: "activity",
    operation: "create",
    entityId: "activity-local-1",
    payload: {
      tripId: "trip-1",
      title: "Museu",
      occursAt: "2026-10-02T14:00:00.000Z",
    },
    createdAt: "2026-10-01T10:00:00.000Z",
    retryCount: 0,
    status: "pending",
    lastError: null,
    dependsOnEntityId: null,
    nextRetryAt: null,
    ...override,
  };
}

const activityItem = makeQueueItem({});

const linkItem = makeQueueItem({
  id: "queue-2",
  entityType: "link",
  entityId: "link-local-1",
  payload: {
    tripId: "trip-1",
    title: "Reserva",
    url: "https://example.com/reserva",
  },
});

function queueOnce(item: SyncQueueItem) {
  (getQueueItemsOrdered as jest.Mock)
    .mockResolvedValueOnce([item])
    .mockResolvedValue([]);
}

async function flushPromises() {
  await new Promise<void>((resolve) => setImmediate(resolve));
}

describe("sync-engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should store the remote id returned when creating an activity", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: "activity-remote-1",
    });

    await processSyncQueue();

    expect(activitiesServer.create).toHaveBeenCalledWith({
      tripId: "trip-remote-1",
      title: "Museu",
      occursAt: "2026-10-02T14:00:00.000Z",
    });
    expect(updateActivityRemoteIdAfterSync).toHaveBeenCalledWith(
      "activity-local-1",
      "activity-remote-1",
    );
    expect(markActivitySyncedWithoutRemoteId).not.toHaveBeenCalled();
    expect(removeQueueItems).toHaveBeenCalledWith(["queue-1"]);
  });

  it("should store the remote id returned when creating a link", async () => {
    queueOnce(linkItem);
    (linksServer.create as jest.Mock).mockResolvedValue({
      linkId: "link-remote-1",
    });

    await processSyncQueue();

    expect(updateLinkRemoteIdAfterSync).toHaveBeenCalledWith(
      "link-local-1",
      "link-remote-1",
    );
    expect(markLinkSyncedWithoutRemoteId).not.toHaveBeenCalled();
    expect(removeQueueItems).toHaveBeenCalledWith(["queue-2"]);
  });

  it("should mark the activity as synced without remote id when the api returns no id", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: null,
    });

    await processSyncQueue();

    expect(markActivitySyncedWithoutRemoteId).toHaveBeenCalledWith(
      "activity-local-1",
    );
    expect(updateActivityRemoteIdAfterSync).not.toHaveBeenCalled();
    expect(notifyTripDataUpdated).toHaveBeenCalledWith("trip-1");
  });

  it("should mark the link as synced without remote id when the api returns no id", async () => {
    queueOnce(linkItem);
    (linksServer.create as jest.Mock).mockResolvedValue({ linkId: null });

    await processSyncQueue();

    expect(markLinkSyncedWithoutRemoteId).toHaveBeenCalledWith("link-local-1");
    expect(updateLinkRemoteIdAfterSync).not.toHaveBeenCalled();
  });

  it("should not retry the activity create when the api returns no id", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: null,
    });

    await processSyncQueue();

    expect(activitiesServer.create).toHaveBeenCalledTimes(1);
    expect(removeQueueItems).toHaveBeenCalledWith(["queue-1"]);
    expect(markQueueItemFailed).not.toHaveBeenCalled();
    expect(markActivitySyncFailed).not.toHaveBeenCalled();
  });

  it("should schedule a trip pull when the api returns no id", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: null,
    });

    await processSyncQueue();
    await flushPromises();

    expect(syncActivities).toHaveBeenCalledWith("trip-1");
  });

  it("should treat a 401 AppError as an auth error and stop the queue", async () => {
    (getQueueItemsOrdered as jest.Mock)
      .mockResolvedValueOnce([activityItem, linkItem])
      .mockResolvedValue([]);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Token inválido", { status: 401 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "AUTH_ERROR",
      1,
      null,
    );
    expect(markActivitySyncFailed).toHaveBeenCalledWith(
      "activity-local-1",
      "AUTH_ERROR",
    );
    expect(linksServer.create).not.toHaveBeenCalled();
  });

  it("should reload the trip from the server on a 409 AppError", async () => {
    const serverTrip = { id: "trip-remote-1", destination: "Paris" };

    queueOnce(
      makeQueueItem({
        id: "queue-3",
        entityType: "trip",
        operation: "update",
        entityId: "trip-local-1",
        payload: {
          destination: "Paris",
          startsAt: "2026-10-01T00:00:00.000Z",
          endsAt: "2026-10-05T00:00:00.000Z",
        },
      }),
    );
    (tripServer.update as jest.Mock).mockRejectedValue(
      new AppError("Viagem em conflito", { status: 409 }),
    );
    (tripServer.getById as jest.Mock).mockResolvedValue(serverTrip);

    await processSyncQueue();

    expect(tripServer.getById).toHaveBeenCalledWith("trip-remote-1");
    expect(overwriteTripFromServer).toHaveBeenCalledWith(serverTrip);
    expect(removeQueueItems).toHaveBeenCalledWith(["queue-3"]);
    expect(markQueueItemFailed).not.toHaveBeenCalled();
  });

  it("should store the api message as the queue error", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Viagem não encontrada", { status: 404 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Viagem não encontrada",
      1,
      expect.any(String),
    );
  });

  it("should not schedule a trip pull when the api returns the id", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: "activity-remote-1",
    });

    await processSyncQueue();
    await flushPromises();

    expect(syncActivities).not.toHaveBeenCalled();
  });
});
