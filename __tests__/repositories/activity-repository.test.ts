import {
  getActivitiesByTripIdGrouped,
  markActivitySyncedWithoutRemoteId,
  mergeActivitiesFromServer,
} from "@/repositories/activity-repository";

const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(
  async (callback: () => Promise<void>) => {
    await callback();
  },
);

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      getAllAsync: mockGetAllAsync,
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

function activityRow(id: string, occursAt: string) {
  return {
    id,
    trip_id: "trip-1",
    title: `Atividade ${id}`,
    occurs_at: occursAt,
    remote_id: id,
    sync_status: "synced",
    last_sync_error: null,
  };
}

describe("activity-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("grouped activities in Sao Paulo", () => {
    afterEach(() => {
      jest.useRealTimers();
    });

    beforeEach(() => {
      mockGetAllAsync.mockResolvedValue([
        activityRow("late", "2026-10-05T22:00:00.000Z"),
        activityRow("early", "2026-10-05T02:00:00.000Z"),
      ]);
    });

    it("should group activities by their wall clock day", async () => {
      const sections = await getActivitiesByTripIdGrouped("trip-1");

      expect(sections).toHaveLength(1);
      expect(sections[0].title.dayNumber).toBe(5);
      expect(sections[0].data.map((activity) => activity.id)).toEqual([
        "early",
        "late",
      ]);
    });

    it("should show the activity hour in 24h wall clock time", async () => {
      const sections = await getActivitiesByTripIdGrouped("trip-1");

      expect(sections[0].data.map((activity) => activity.hour)).toEqual([
        "02:00h",
        "22:00h",
      ]);
    });

    it("should mark only activities before the local wall clock time as past", async () => {
      jest.useFakeTimers({ now: new Date(2026, 9, 5, 20, 0, 0) });

      const sections = await getActivitiesByTripIdGrouped("trip-1");

      expect(
        sections[0].data.map((activity) => [activity.id, activity.isBefore]),
      ).toEqual([
        ["early", true],
        ["late", false],
      ]);
    });
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
