import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { participantsServer } from "@/server/participants-server";
import {
  syncActivities,
  syncTripDetail,
  syncTripDetails,
  syncTravelerTrips,
} from "@/services/sync-service";
import { tripServer } from "@/server/trip-server";
import {
  mergeTravelerTripsFromServer,
  setNextTripId,
} from "@/repositories/trip-repository";

jest.mock("@/server/trip-server", () => ({
  tripServer: {
    getAllTripsByTraveler: jest.fn(),
    getNextTripsByTraveler: jest.fn(),
    getById: jest.fn(),
  },
}));

jest.mock("@/server/activities-server", () => ({
  activitiesServer: { getActivitiesByTripId: jest.fn() },
}));

jest.mock("@/server/links-server", () => ({
  linksServer: { getLinksByTripId: jest.fn() },
}));

jest.mock("@/server/participants-server", () => ({
  participantsServer: { getByTripId: jest.fn() },
}));

jest.mock("@/repositories/trip-repository", () => ({
  mergeTravelerTripsFromServer: jest.fn(),
  setNextTripId: jest.fn(),
  resolveRemoteId: jest.fn(() => Promise.resolve(null)),
  resolveLocalTripId: jest.fn(() => Promise.resolve("trip-local-1")),
  upsertTripDetail: jest.fn(),
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

  it("should skip all trip data requests when there is no remote id", async () => {
    await expect(syncTripDetail("trip-local-1")).resolves.toBeNull();
    await expect(syncActivities("trip-local-1")).resolves.toBeNull();
    await expect(syncTripDetails("trip-local-1")).resolves.toBeNull();

    expect(tripServer.getById).not.toHaveBeenCalled();
    expect(activitiesServer.getActivitiesByTripId).not.toHaveBeenCalled();
    expect(linksServer.getLinksByTripId).not.toHaveBeenCalled();
    expect(participantsServer.getByTripId).not.toHaveBeenCalled();
  });
});
