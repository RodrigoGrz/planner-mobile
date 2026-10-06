import {
  getTravelerTrips,
  isTripInvitePending,
  removeTripLocally,
  setNextTripId,
  upsertTravelerTrips,
  upsertTripDetail,
} from "@/repositories/trip-repository";
import { setSyncMetadata } from "@/database/sync-metadata";
import { TripByID, TripDetails } from "@/server/trip-server";

const mockRunAsync = jest.fn();
const mockGetAllAsync = jest.fn();
const mockGetFirstAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(async (callback: () => Promise<void>) => {
  await callback();
});

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      getAllAsync: mockGetAllAsync,
      getFirstAsync: mockGetFirstAsync,
      withTransactionAsync: mockWithTransactionAsync,
    }),
  ),
}));

jest.mock("@/database/sync-metadata", () => ({
  setSyncMetadata: jest.fn(),
}));

describe("trip-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should map traveler trips from database rows", async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        participant_id: "p1",
        trip_id: "t1",
        destination: "Paris",
        starts_at: "2026-01-01T00:00:00.000Z",
        ends_at: "2026-01-10T00:00:00.000Z",
        is_confirmed: 1,
        cover_image_url: null,
      },
    ]);

    const trips = await getTravelerTrips();

    expect(trips).toEqual([
      {
        participantId: "p1",
        tripId: "t1",
        destination: "Paris",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-10T00:00:00.000Z",
        isConfirmed: true,
        coverImageUrl: null,
      },
    ]);
  });

  it("should upsert traveler trips inside a transaction", async () => {
    const trips: TripDetails[] = [
      {
        participantId: "p1",
        tripId: "t1",
        destination: "Paris",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-10T00:00:00.000Z",
        isConfirmed: true,
        coverImageUrl: null,
      },
    ];

    await upsertTravelerTrips(trips);

    expect(mockWithTransactionAsync).toHaveBeenCalled();
    expect(mockRunAsync).toHaveBeenCalled();
  });

  it("should store next trip id metadata", async () => {
    await setNextTripId("t1");

    expect(setSyncMetadata).toHaveBeenCalledWith("next_trip_id", "t1");
  });

  it("should upsert trip detail", async () => {
    const trip: TripByID = {
      id: "t1",
      destination: "Paris",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-01-10T00:00:00.000Z"),
      coverImageUrl: null,
      ownerName: "Ana",
      createdAt: new Date("2025-12-01T00:00:00.000Z"),
      updatedAt: new Date("2025-12-01T00:00:00.000Z"),
    };

    await upsertTripDetail(trip);

    expect(mockRunAsync).toHaveBeenCalledWith(
      expect.stringContaining("INSERT INTO trips"),
      expect.arrayContaining(["t1", "Paris"]),
    );
  });

  describe("isTripInvitePending", () => {
    function mockTravelerTrip(row: { is_confirmed: number } | null) {
      mockGetFirstAsync.mockImplementation(async (sql: string) =>
        sql.includes("FROM traveler_trips") ? row : null,
      );
    }

    it("should report a pending invite when the traveler trip is not confirmed", async () => {
      mockTravelerTrip({ is_confirmed: 0 });

      await expect(isTripInvitePending("trip-1")).resolves.toBe(true);

      const travelerTripQuery = mockGetFirstAsync.mock.calls.find(([sql]) =>
        (sql as string).includes("FROM traveler_trips"),
      );
      expect(travelerTripQuery?.[1]).toEqual(expect.arrayContaining(["trip-1"]));
    });

    it("should not report a pending invite for a confirmed traveler trip", async () => {
      mockTravelerTrip({ is_confirmed: 1 });

      await expect(isTripInvitePending("trip-1")).resolves.toBe(false);
    });

    it("should not report a pending invite when there is no traveler trip", async () => {
      mockTravelerTrip(null);

      await expect(isTripInvitePending("trip-1")).resolves.toBe(false);
    });
  });

  describe("removeTripLocally", () => {
    function deleteCallFor(table: string) {
      return mockRunAsync.mock.calls.find(([sql]) =>
        (sql as string).includes(`DELETE FROM ${table}`),
      );
    }

    it("should remove the trip, its children, metadata and queue items in one transaction", async () => {
      mockGetFirstAsync.mockResolvedValue(null);
      mockWithTransactionAsync.mockImplementationOnce(async (callback) => {
        expect(mockRunAsync).not.toHaveBeenCalled();
        await callback();
      });

      const removedIds = await removeTripLocally("t1");

      expect(removedIds).toEqual(["t1"]);
      expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
      for (const table of [
        "activities",
        "links",
        "participants",
        "traveler_trips",
        "trips",
        "sync_metadata",
        "sync_queue",
      ]) {
        expect(deleteCallFor(table)?.[1]).toEqual(expect.arrayContaining(["t1"]));
      }
    });

    it("should remove the trip by every resolved id", async () => {
      mockGetFirstAsync.mockImplementation(async (sql: string, params: string[]) => {
        if (sql.includes("sync_metadata") && params[0] === "trip_alias:local-1") {
          return { value: "remote-1" };
        }

        return null;
      });

      const removedIds = await removeTripLocally("local-1");

      expect(removedIds).toEqual(expect.arrayContaining(["local-1", "remote-1"]));
      expect(deleteCallFor("trips")?.[1]).toEqual(
        expect.arrayContaining(["local-1", "remote-1"]),
      );
      expect(deleteCallFor("activities")?.[1]).toEqual(
        expect.arrayContaining(["local-1", "remote-1"]),
      );
      expect(deleteCallFor("sync_metadata")?.[1]).toEqual(
        expect.arrayContaining([
          "trip:local-1",
          "trip:remote-1",
          "trip_alias:local-1",
          "trip_alias:remote-1",
          "activities:local-1",
          "activities:remote-1",
          "links:local-1",
          "links:remote-1",
          "participants:local-1",
          "participants:remote-1",
        ]),
      );
    });

    it("should remove queue items by entity, dependency and payload trip id", async () => {
      mockGetFirstAsync.mockResolvedValue(null);

      await removeTripLocally("t1");

      const [sql] = deleteCallFor("sync_queue") ?? [];
      expect(sql).toContain("entity_id IN");
      expect(sql).toContain("depends_on_entity_id IN");
      expect(sql).toContain("json_extract(payload, '$.tripId') IN");
    });

    it("should clear next_trip_id when it points to the removed trip", async () => {
      mockGetFirstAsync.mockResolvedValue(null);

      await removeTripLocally("t1");

      const [sql] = deleteCallFor("sync_metadata") ?? [];
      expect(sql).toContain("key = 'next_trip_id'");
      expect(sql).toContain("key LIKE 'trip_alias:%'");
    });
  });
});
