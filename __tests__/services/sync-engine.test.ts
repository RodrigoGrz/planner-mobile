import {
  markActivitySyncedWithoutRemoteId,
  markActivitySyncFailed,
  resetActivitySyncStatus,
  updateActivityRemoteIdAfterSync,
} from "@/repositories/activity-repository";
import {
  markLinkSyncedWithoutRemoteId,
  updateLinkRemoteIdAfterSync,
} from "@/repositories/link-repository";
import {
  countQueueItemsWaitingToSend,
  getQueueItemsOrdered,
  markQueueItemFailed,
  removeQueueItems,
  resetQueueItemsFailedByAuth,
  resetStaleSyncingItems,
} from "@/repositories/sync-queue-repository";
import {
  getStoredRemoteId,
  isTripInvitePending,
  markTripSyncFailed,
  overwriteTripFromServer,
  removeTripLocally,
  resetTripSyncStatus,
} from "@/repositories/trip-repository";
import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { tripServer } from "@/server/trip-server";
import {
  processSyncQueue,
  pullSyncTripData,
  runInitialSyncIfOnline,
  subscribeSyncFailure,
} from "@/services/sync-engine";
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
  countQueueItemsWaitingToSend: jest.fn(() => Promise.resolve(0)),
  countFailedQueueItems: jest.fn(),
  countPendingQueueItems: jest.fn(),
  countSyncingQueueItems: jest.fn(),
  getQueueItemsOrdered: jest.fn(),
  markQueueItemFailed: jest.fn(),
  markQueueItemSyncing: jest.fn(),
  removeQueueItems: jest.fn(),
  resetFailedQueueItems: jest.fn(),
  resetQueueItemsFailedByAuth: jest.fn(),
  resetStaleSyncingItems: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  getStoredRemoteId: jest.fn(),
  isTripAvailableForChildSync: jest.fn(() => Promise.resolve(true)),
  isTripInvitePending: jest.fn(() => Promise.resolve(false)),
  markTripImageSyncFailed: jest.fn(),
  markTripSyncFailed: jest.fn(),
  markTripSyncing: jest.fn(),
  overwriteTripFromServer: jest.fn(),
  removeTripLocally: jest.fn(),
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
    create: jest.fn(),
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
  notifyTripRemoved: jest.fn(),
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

const tripUpdateItem = makeQueueItem({
  id: "queue-3",
  entityType: "trip",
  operation: "update",
  entityId: "trip-local-1",
  payload: {
    destination: "Paris",
    startsAt: "2026-10-01T00:00:00.000Z",
    endsAt: "2026-10-05T00:00:00.000Z",
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
  const failureListener = jest.fn();
  let unsubscribeFailure: () => void;

  beforeEach(() => {
    jest.clearAllMocks();
    unsubscribeFailure = subscribeSyncFailure(failureListener);
  });

  afterEach(() => {
    unsubscribeFailure();
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

  describe("pullSyncTripData for pending invites", () => {
    it("should only pull the trip detail of a pending invite", async () => {
      (isTripInvitePending as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await pullSyncTripData("trip-1");

      expect(syncTripDetail).toHaveBeenCalledWith("trip-1");
      expect(syncActivities).not.toHaveBeenCalled();
      expect(syncTripDetails).not.toHaveBeenCalled();
    });

    it("should refresh the traveler trips before pulling a pending invite", async () => {
      (isTripInvitePending as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);

      await pullSyncTripData("trip-1");

      expect(syncTravelerTrips).toHaveBeenCalledTimes(1);
      expect(
        (syncTravelerTrips as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan((syncTripDetail as jest.Mock).mock.invocationCallOrder[0]);
    });

    it("should still pull the trip detail of a pending invite when refreshing the traveler trips fails", async () => {
      (isTripInvitePending as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(true);
      (syncTravelerTrips as jest.Mock).mockRejectedValueOnce(
        new AppError("Sem conexão com o servidor.", { code: "NETWORK" }),
      );

      await expect(pullSyncTripData("trip-1")).resolves.toBeUndefined();

      expect(syncTripDetail).toHaveBeenCalledWith("trip-1");
      expect(syncActivities).not.toHaveBeenCalled();
      expect(syncTripDetails).not.toHaveBeenCalled();
    });

    it("should pull everything once the invite is confirmed", async () => {
      (isTripInvitePending as jest.Mock)
        .mockResolvedValueOnce(true)
        .mockResolvedValueOnce(false);

      await pullSyncTripData("trip-1");

      expect(syncTripDetail).toHaveBeenCalledWith("trip-1");
      expect(syncActivities).toHaveBeenCalledWith("trip-1");
      expect(syncTripDetails).toHaveBeenCalledWith("trip-1");
    });

    it("should pull everything for a trip that is not a pending invite", async () => {
      await pullSyncTripData("trip-1");

      expect(syncTravelerTrips).not.toHaveBeenCalled();
      expect(syncTripDetail).toHaveBeenCalledWith("trip-1");
      expect(syncActivities).toHaveBeenCalledWith("trip-1");
      expect(syncTripDetails).toHaveBeenCalledWith("trip-1");
    });
  });

  it("should pull the trips after the push when only failed items remain", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: "activity-remote-1",
    });
    (countQueueItemsWaitingToSend as jest.Mock).mockResolvedValueOnce(0);

    await processSyncQueue();

    expect(syncTravelerTrips).toHaveBeenCalledTimes(1);
  });

  it("should not pull the trips while items are waiting to be sent", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: "activity-remote-1",
    });
    (countQueueItemsWaitingToSend as jest.Mock).mockResolvedValueOnce(1);

    await processSyncQueue();

    expect(syncTravelerTrips).not.toHaveBeenCalled();
  });

  it("should keep queue items pending after an auth error", async () => {
    (getQueueItemsOrdered as jest.Mock)
      .mockResolvedValueOnce([activityItem, linkItem])
      .mockResolvedValue([]);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Não autorizado", { status: 401 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Sua sessão expirou. Entre novamente para sincronizar suas alterações.",
      0,
      expect.any(String),
    );
    expect(resetActivitySyncStatus).toHaveBeenCalledWith(
      "activity-local-1",
      "pending",
    );
    expect(markActivitySyncFailed).not.toHaveBeenCalled();
    expect(linksServer.create).not.toHaveBeenCalled();
  });

  it("should not notify a failure after an auth error", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Não autorizado", { status: 401 }),
    );

    await processSyncQueue();

    expect(failureListener).not.toHaveBeenCalled();
  });

  it("should reset items failed by a legacy auth error before the initial sync", async () => {
    (getQueueItemsOrdered as jest.Mock).mockResolvedValue([]);

    await runInitialSyncIfOnline(true);

    expect(resetQueueItemsFailedByAuth).toHaveBeenCalledTimes(1);
    expect(
      (resetQueueItemsFailedByAuth as jest.Mock).mock.invocationCallOrder[0],
    ).toBeLessThan((getQueueItemsOrdered as jest.Mock).mock.invocationCallOrder[0]);
  });

  it("should not reset legacy auth failures when offline", async () => {
    await runInitialSyncIfOnline(false);

    expect(resetQueueItemsFailedByAuth).not.toHaveBeenCalled();
  });

  it("should retry a 409 response with backoff", async () => {
    queueOnce(tripUpdateItem);
    (tripServer.update as jest.Mock).mockRejectedValue(
      new AppError("A viagem foi alterada por outra requisição", { status: 409 }),
    );

    await processSyncQueue();

    expect(tripServer.getById).not.toHaveBeenCalled();
    expect(overwriteTripFromServer).not.toHaveBeenCalled();
    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-3",
      "A viagem foi alterada por outra requisição",
      1,
      expect.any(String),
    );
    expect(resetTripSyncStatus).toHaveBeenCalledWith("trip-local-1", "pending");
  });

  it("should store the api message as the queue error", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Viagem em conflito", { status: 409 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Viagem em conflito",
      1,
      expect.any(String),
    );
  });

  it("should not retry a 422 response", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("A data está fora das datas da viagem", { status: 422 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "A data está fora das datas da viagem",
      1,
      null,
    );
    expect(markActivitySyncFailed).toHaveBeenCalledWith(
      "activity-local-1",
      "A data está fora das datas da viagem",
    );
    expect(resetActivitySyncStatus).not.toHaveBeenCalled();
  });

  it.each([
    [422, "Data de início inválida."],
    [403, "Você não tem permissão para alterar esta viagem."],
  ])(
    "should reload the trip from the server when an update returns %i",
    async (status, message) => {
      const serverTrip = { id: "trip-remote-1", destination: "Paris" };
      queueOnce(tripUpdateItem);
      (tripServer.update as jest.Mock).mockRejectedValue(
        new AppError("Data de início inválida.", { status }),
      );
      (tripServer.getById as jest.Mock).mockResolvedValue(serverTrip);

      await processSyncQueue();

      expect(tripServer.getById).toHaveBeenCalledWith("trip-remote-1");
      expect(overwriteTripFromServer).toHaveBeenCalledWith(serverTrip);
      expect(notifyTripDataUpdated).toHaveBeenCalledWith("trip-local-1");
      expect(removeQueueItems).toHaveBeenCalledWith(["queue-3"]);
      expect(markQueueItemFailed).not.toHaveBeenCalled();
      expect(failureListener).toHaveBeenCalledWith({ message });
    },
  );

  it("should mark the trip as failed when the reload after a 403 also fails", async () => {
    queueOnce(tripUpdateItem);
    (tripServer.update as jest.Mock).mockRejectedValue(
      new AppError("Não permitido", { status: 403 }),
    );
    (tripServer.getById as jest.Mock).mockRejectedValue(
      new AppError("Não permitido", { status: 403 }),
    );

    await processSyncQueue();

    expect(overwriteTripFromServer).not.toHaveBeenCalled();
    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-3",
      "Você não tem permissão para alterar esta viagem.",
      1,
      null,
    );
    expect(markTripSyncFailed).toHaveBeenCalledWith(
      "trip-local-1",
      "Você não tem permissão para alterar esta viagem.",
    );
  });

  it("should remove the local trip when an update returns 404", async () => {
    queueOnce(tripUpdateItem);
    (getStoredRemoteId as jest.Mock).mockResolvedValue("trip-remote-1");
    (removeTripLocally as jest.Mock).mockResolvedValue([
      "trip-local-1",
      "trip-remote-1",
    ]);
    (tripServer.update as jest.Mock).mockRejectedValue(
      new AppError("Recurso não encontrado.", { status: 404 }),
    );

    await processSyncQueue();

    expect(removeTripLocally).toHaveBeenCalledWith("trip-local-1");
    expect(notifyTripRemoved).toHaveBeenCalledWith([
      "trip-local-1",
      "trip-remote-1",
    ]);
    expect(markQueueItemFailed).not.toHaveBeenCalled();
    expect(markTripSyncFailed).not.toHaveBeenCalled();
    expect(failureListener).toHaveBeenCalledWith({
      message: "Esta viagem não existe mais e foi removida do aparelho.",
    });
  });

  it("should remove the local trip when an activity create returns 404", async () => {
    queueOnce(activityItem);
    (getStoredRemoteId as jest.Mock).mockResolvedValue("trip-remote-1");
    (removeTripLocally as jest.Mock).mockResolvedValue(["trip-1", "trip-remote-1"]);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Recurso não encontrado.", { status: 404 }),
    );

    await processSyncQueue();

    expect(removeTripLocally).toHaveBeenCalledWith("trip-1");
    expect(notifyTripRemoved).toHaveBeenCalledWith(["trip-1", "trip-remote-1"]);
    expect(markActivitySyncFailed).not.toHaveBeenCalled();
  });

  it("should not remove the local trip when the route does not exist", async () => {
    queueOnce(activityItem);
    (getStoredRemoteId as jest.Mock).mockResolvedValue("trip-remote-1");
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Route POST:/trips/activity/register not found", {
        status: 404,
        code: "ROUTE_NOT_FOUND",
      }),
    );

    await processSyncQueue();

    expect(removeTripLocally).not.toHaveBeenCalled();
    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Esta versão do app não é mais compatível com o servidor. Atualize o app.",
      1,
      null,
    );
  });

  it("should treat a 404 on a trip without remote id as permanent", async () => {
    queueOnce(
      makeQueueItem({
        id: "queue-4",
        entityType: "trip",
        operation: "create",
        entityId: "trip-local-1",
        payload: {
          destination: "Paris",
          startsAt: "2026-10-01T00:00:00.000Z",
          endsAt: "2026-10-05T00:00:00.000Z",
          emailsToInvite: [],
          ownerName: "Ana",
        },
      }),
    );
    (getStoredRemoteId as jest.Mock).mockResolvedValue(null);
    (tripServer.create as jest.Mock).mockRejectedValue(
      new AppError("Recurso não encontrado.", { status: 404 }),
    );

    await processSyncQueue();

    expect(removeTripLocally).not.toHaveBeenCalled();
    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-4",
      "Recurso não encontrado.",
      1,
      null,
    );
    expect(markTripSyncFailed).toHaveBeenCalledWith(
      "trip-local-1",
      "Recurso não encontrado.",
    );
  });

  it("should retry 5xx responses with backoff", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Internal server error", { status: 503 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Algo deu errado no servidor. Tente novamente em instantes.",
      1,
      expect.any(String),
    );
    expect(resetActivitySyncStatus).toHaveBeenCalledWith(
      "activity-local-1",
      "pending",
    );
    expect(markActivitySyncFailed).not.toHaveBeenCalled();
  });

  it("should notify a failure with its message at the end of the run", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("A data está fora das datas da viagem", { status: 422 }),
    );

    await processSyncQueue();

    expect(failureListener).toHaveBeenCalledTimes(1);
    expect(failureListener).toHaveBeenCalledWith({
      message: "A data está fora das datas da viagem",
    });
  });

  it("should summarize multiple failures in a single notification", async () => {
    (getQueueItemsOrdered as jest.Mock)
      .mockResolvedValueOnce([activityItem, linkItem])
      .mockResolvedValue([]);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("A data está fora das datas da viagem", { status: 422 }),
    );
    (linksServer.create as jest.Mock).mockRejectedValue(
      new AppError("Link inválido", { status: 400 }),
    );

    await processSyncQueue();

    expect(failureListener).toHaveBeenCalledTimes(1);
    expect(failureListener).toHaveBeenCalledWith({
      message: "2 alterações não puderam ser sincronizadas.",
    });
  });

  it("should notify a failure when a retryable error exhausts the retries", async () => {
    queueOnce(makeQueueItem({ retryCount: 4 }));
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Internal server error", { status: 503 }),
    );

    await processSyncQueue();

    expect(markQueueItemFailed).toHaveBeenCalledWith(
      "queue-1",
      "Algo deu errado no servidor. Tente novamente em instantes.",
      5,
      null,
    );
    expect(failureListener).toHaveBeenCalledWith({
      message: "Algo deu errado no servidor. Tente novamente em instantes.",
    });
  });

  it("should not notify a failure before the last retry", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockRejectedValue(
      new AppError("Internal server error", { status: 503 }),
    );

    await processSyncQueue();

    expect(failureListener).not.toHaveBeenCalled();
  });

  it("should not notify a failure when the sync succeeds", async () => {
    queueOnce(activityItem);
    (activitiesServer.create as jest.Mock).mockResolvedValue({
      activityId: "activity-remote-1",
    });

    await processSyncQueue();

    expect(failureListener).not.toHaveBeenCalled();
  });

  describe("rate limit", () => {
    const now = new Date("2026-10-06T12:00:00.000Z");

    beforeEach(() => {
      jest.useFakeTimers({ now });
    });

    afterEach(() => {
      jest.clearAllTimers();
      jest.useRealTimers();
    });

    it("should retry a 429 after the Retry-After delay without consuming a retry", async () => {
      queueOnce(makeQueueItem({ retryCount: 2 }));
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );

      await processSyncQueue();

      expect(markQueueItemFailed).toHaveBeenCalledWith(
        "queue-1",
        "Muitas requisições, tentando novamente em instantes.",
        2,
        "2026-10-06T12:00:30.000Z",
      );
      expect(resetActivitySyncStatus).toHaveBeenCalledWith(
        "activity-local-1",
        "pending",
      );
      expect(markActivitySyncFailed).not.toHaveBeenCalled();
    });

    it("should stop processing the queue after a 429", async () => {
      (getQueueItemsOrdered as jest.Mock)
        .mockResolvedValueOnce([activityItem, linkItem])
        .mockResolvedValue([]);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );

      await processSyncQueue();

      expect(linksServer.create).not.toHaveBeenCalled();
    });

    it("should run the queue again when the Retry-After delay elapses", async () => {
      queueOnce(activityItem);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );

      await processSyncQueue();
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(29999);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(2);
    });

    it("should wait at least the base delay when Retry-After is zero", async () => {
      queueOnce(activityItem);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 0 }),
      );

      await processSyncQueue();

      expect(markQueueItemFailed).toHaveBeenCalledWith(
        "queue-1",
        "Muitas requisições, tentando novamente em instantes.",
        0,
        "2026-10-06T12:00:01.000Z",
      );

      await jest.advanceTimersByTimeAsync(999);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(1);

      await jest.advanceTimersByTimeAsync(1);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(2);
    });

    it("should run the queue again when the Retry-After delay elapses during another sync", async () => {
      queueOnce(activityItem);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );

      await processSyncQueue();

      let releaseRunningSync: () => void = () => {};
      (resetStaleSyncingItems as jest.Mock).mockImplementationOnce(
        () =>
          new Promise<void>((resolve) => {
            releaseRunningSync = resolve;
          }),
      );
      const runningSync = processSyncQueue();

      await jest.advanceTimersByTimeAsync(30000);
      releaseRunningSync();
      await runningSync;
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(1000);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(3);
    });

    it("should cancel the scheduled rate limit run after an auth error", async () => {
      (getQueueItemsOrdered as jest.Mock)
        .mockResolvedValueOnce([activityItem])
        .mockResolvedValueOnce([linkItem])
        .mockResolvedValue([]);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );
      (linksServer.create as jest.Mock).mockRejectedValue(
        new AppError("Não autorizado", { status: 401 }),
      );

      await processSyncQueue();
      await processSyncQueue();
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(2);

      await jest.advanceTimersByTimeAsync(30000);
      expect(getQueueItemsOrdered).toHaveBeenCalledTimes(2);
    });

    it("should not notify a failure for a 429", async () => {
      queueOnce(activityItem);
      (activitiesServer.create as jest.Mock).mockRejectedValue(
        new AppError("Too many requests", { status: 429, retryAfterMs: 30000 }),
      );

      await processSyncQueue();

      expect(failureListener).not.toHaveBeenCalled();
    });
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
