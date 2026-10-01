import {
  markActivitySyncedWithoutRemoteId,
  mergeActivitiesFromServer,
} from "@/repositories/activity-repository";

const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(
  async (callback: () => Promise<void>) => {
    await callback();
  },
);

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      withTransactionAsync: mockWithTransactionAsync,
    }),
  ),
}));

jest.mock("@/database/sync-metadata", () => ({
  setSyncMetadata: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  resolveLocalTripId: jest.fn((tripId: string) => Promise.resolve(tripId)),
  resolveAllTripIds: jest.fn((tripId: string) => Promise.resolve([tripId])),
}));

function insertCalls() {
  return mockRunAsync.mock.calls.filter(([sql]) =>
    String(sql).includes("INSERT INTO activities"),
  );
}

describe("activity-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should mark an activity as synced keeping its local id", async () => {
    await markActivitySyncedWithoutRemoteId("activity-local-1");

    expect(mockRunAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = mockRunAsync.mock.calls[0];

    expect(sql).toMatch(/UPDATE activities/);
    expect(sql).toMatch(/sync_status = 'synced'/);
    expect(sql).toMatch(/last_sync_error = NULL/);
    expect(sql).not.toMatch(/remote_id/);
    expect(params).toEqual(["activity-local-1"]);
  });

  it("should keep activity ids when merging the same server activities twice", async () => {
    const serverActivities = [
      {
        date: "2026-10-02",
        activities: [
          {
            id: "activity-remote-1",
            title: "Museu",
            occursAt: "2026-10-02T14:00:00.000Z",
          },
        ],
      },
    ];

    await mergeActivitiesFromServer("trip-1", serverActivities);
    await mergeActivitiesFromServer("trip-1", serverActivities);

    const inserts = insertCalls();

    expect(inserts).toHaveLength(2);

    for (const [, params] of inserts) {
      expect(params[0]).toBe("activity-remote-1");
      expect(params[4]).toBe("activity-remote-1");
    }
  });
});
