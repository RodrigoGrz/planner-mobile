import {
  getTravelerTrips,
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
});
