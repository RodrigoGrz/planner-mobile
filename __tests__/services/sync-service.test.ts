import { syncTravelerTrips } from "@/services/sync-service";
import { tripServer } from "@/server/trip-server";
import {
  mergeTravelerTripsFromServer,
  setNextTripId,
} from "@/repositories/trip-repository";

jest.mock("@/server/trip-server", () => ({
  tripServer: {
    getAllTripsByTraveler: jest.fn(),
    getNextTripsByTraveler: jest.fn(),
  },
}));

jest.mock("@/repositories/trip-repository", () => ({
  mergeTravelerTripsFromServer: jest.fn(),
  setNextTripId: jest.fn(),
}));

describe("sync-service", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch traveler trips and persist them locally", async () => {
    const trips = [
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

    (tripServer.getAllTripsByTraveler as jest.Mock).mockResolvedValue({
      data: { trips },
    });

    (tripServer.getNextTripsByTraveler as jest.Mock).mockResolvedValue({
      data: { nextTrip: trips[0] },
    });

    const result = await syncTravelerTrips();

    expect(mergeTravelerTripsFromServer).toHaveBeenCalledWith(trips);
    expect(setNextTripId).toHaveBeenCalledWith("t1");
    expect(result.trips).toEqual(trips);
    expect(result.nextTrip).toEqual(trips[0]);
  });
});
