import { coalesceQueueItems } from "@/services/queue-coalescer";
import { SyncQueueItem } from "@/types/sync";

function buildQueueItem(
  overrides: Partial<SyncQueueItem> & Pick<SyncQueueItem, "id" | "entityId" | "operation">,
): SyncQueueItem {
  return {
    entityType: "trip",
    payload: {
      destination: "Paris",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-01-05T00:00:00.000Z",
      emailsToInvite: [],
      ownerName: "Traveler",
    },
    createdAt: "2026-01-01T00:00:00.000Z",
    retryCount: 0,
    status: "pending",
    lastError: null,
    dependsOnEntityId: null,
    nextRetryAt: null,
    ...overrides,
  };
}

describe("coalesceQueueItems", () => {
  it("merges create followed by updates into a single create payload", () => {
    const items: SyncQueueItem[] = [
      buildQueueItem({
        id: "1",
        entityId: "trip-1",
        operation: "create",
        createdAt: "2026-01-01T00:00:00.000Z",
      }),
      buildQueueItem({
        id: "2",
        entityId: "trip-1",
        operation: "update",
        createdAt: "2026-01-01T00:00:01.000Z",
        payload: {
          destination: "Lisboa",
          startsAt: "2026-02-01T00:00:00.000Z",
          endsAt: "2026-02-05T00:00:00.000Z",
        },
      }),
    ];

    const result = coalesceQueueItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].operation).toBe("create");
    expect(result[0].payload).toEqual(
      expect.objectContaining({
        destination: "Lisboa",
        startsAt: "2026-02-01T00:00:00.000Z",
        endsAt: "2026-02-05T00:00:00.000Z",
      }),
    );
    expect(result[0].sourceQueueIds).toEqual(["1", "2"]);
  });

  it("merges multiple updates into one update payload", () => {
    const items: SyncQueueItem[] = [
      buildQueueItem({
        id: "1",
        entityId: "trip-1",
        operation: "update",
        createdAt: "2026-01-01T00:00:00.000Z",
        payload: {
          destination: "Paris",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-01-05T00:00:00.000Z",
        },
      }),
      buildQueueItem({
        id: "2",
        entityId: "trip-1",
        operation: "update",
        createdAt: "2026-01-01T00:00:01.000Z",
        payload: {
          destination: "Berlin",
          startsAt: "2026-03-01T00:00:00.000Z",
          endsAt: "2026-03-05T00:00:00.000Z",
        },
      }),
    ];

    const result = coalesceQueueItems(items);

    expect(result).toHaveLength(1);
    expect(result[0].operation).toBe("update");
    expect(result[0].payload).toEqual({
      destination: "Berlin",
      startsAt: "2026-03-01T00:00:00.000Z",
      endsAt: "2026-03-05T00:00:00.000Z",
    });
  });
});
