import {
  countQueueItemsWaitingToSend,
  getQueueItemsOrdered,
  resetQueueItemsFailedByAuth,
} from "@/repositories/sync-queue-repository";

const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
    }),
  ),
}));

describe("sync-queue-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAllAsync.mockResolvedValue([]);
  });

  it("should only select pending items ready to retry", async () => {
    await getQueueItemsOrdered();

    const [sql] = mockGetAllAsync.mock.calls[0];
    expect(sql).toContain("status = 'pending'");
    expect(sql).not.toContain("'failed'");
    expect(sql).toContain("next_retry_at IS NULL OR next_retry_at <= ?");
  });

  it("should map the selected rows", async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        id: "queue-1",
        entity_type: "activity",
        operation: "create",
        entity_id: "activity-1",
        payload: JSON.stringify({ tripId: "trip-1" }),
        created_at: "2026-10-06T12:00:00.000Z",
        retry_count: 1,
        status: "pending",
        last_error: null,
        depends_on_entity_id: "trip-1",
        next_retry_at: null,
      },
    ]);

    const items = await getQueueItemsOrdered();

    expect(items).toEqual([
      {
        id: "queue-1",
        entityType: "activity",
        operation: "create",
        entityId: "activity-1",
        payload: { tripId: "trip-1" },
        createdAt: "2026-10-06T12:00:00.000Z",
        retryCount: 1,
        status: "pending",
        lastError: null,
        dependsOnEntityId: "trip-1",
        nextRetryAt: null,
      },
    ]);
  });

  it("should count only the items still waiting to be sent", async () => {
    mockGetFirstAsync.mockResolvedValue({ count: 2 });

    const count = await countQueueItemsWaitingToSend();

    expect(count).toBe(2);
    const [sql] = mockGetFirstAsync.mock.calls[0];
    expect(sql).toContain("status IN ('pending', 'syncing')");
    expect(sql).not.toContain("'failed'");
  });

  it("should reset queue items failed by a legacy auth error to pending", async () => {
    await resetQueueItemsFailedByAuth();

    expect(mockRunAsync).toHaveBeenCalledTimes(1);
    const [sql] = mockRunAsync.mock.calls[0];
    expect(sql).toContain("SET status = 'pending', last_error = NULL, next_retry_at = NULL");
    expect(sql).toContain("status = 'failed' AND last_error = 'AUTH_ERROR'");
  });
});
