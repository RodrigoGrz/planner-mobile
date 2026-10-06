import { insertLocalActivity } from "@/repositories/activity-repository";
import { enqueueSyncItemInTransaction } from "@/repositories/sync-queue-transaction";
import { insertLocalTrip, updateLocalTrip } from "@/repositories/trip-repository";
import { mutationService } from "@/services/mutation-service";

const mockDb = {
  withTransactionAsync: jest.fn(async (callback: () => Promise<void>) => {
    await callback();
  }),
};

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() => Promise.resolve(mockDb)),
}));

jest.mock("@/repositories/activity-repository", () => ({
  insertLocalActivity: jest.fn(),
}));

jest.mock("@/repositories/link-repository", () => ({
  insertLocalLink: jest.fn(),
}));

jest.mock("@/repositories/sync-queue-transaction", () => ({
  enqueueSyncItemInTransaction: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  insertLocalTrip: jest.fn(),
  updateLocalTrip: jest.fn(),
  resolveLocalTripId: jest.fn((tripId: string) => Promise.resolve(tripId)),
}));

jest.mock("@/services/sync-engine", () => ({
  processSyncQueue: jest.fn(),
}));

jest.mock("@/services/trip-sync-events", () => ({
  notifyTripDataUpdated: jest.fn(),
}));

jest.mock("@/utils/generate-local-id", () => ({
  generateLocalId: jest.fn(() => "local-1"),
}));

function enqueuedPayload() {
  return (enqueueSyncItemInTransaction as jest.Mock).mock.calls[0][1].payload;
}

describe("mutation-service in Sao Paulo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should store and enqueue the trip days as midnight UTC", async () => {
    await mutationService.createTrip({
      destination: "Paris",
      startsAt: "2026-10-01",
      endsAt: "2026-10-05",
      emailsToInvite: [],
      ownerName: "Ana",
    });

    expect(insertLocalTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: "2026-10-01T00:00:00.000Z",
        endsAt: "2026-10-05T00:00:00.000Z",
      }),
      mockDb,
    );
    expect(enqueuedPayload()).toMatchObject({
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
    });
  });

  it("should store and enqueue the updated trip days as midnight UTC", async () => {
    await mutationService.updateTrip({
      tripId: "trip-1",
      destination: "Paris",
      startsAt: "2026-10-02",
      endsAt: "2026-10-06",
    });

    expect(updateLocalTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: "2026-10-02T00:00:00.000Z",
        endsAt: "2026-10-06T00:00:00.000Z",
      }),
      mockDb,
    );
    expect(enqueuedPayload()).toEqual({
      destination: "Paris",
      startsAt: "2026-10-02T00:00:00.000Z",
      endsAt: "2026-10-06T00:00:00.000Z",
    });
  });

  it("should store and enqueue the activity wall clock time", async () => {
    await mutationService.createActivity({
      tripId: "trip-1",
      title: "Museu",
      date: "2026-10-05",
      hour: 22,
    });

    expect(insertLocalActivity).toHaveBeenCalledWith(
      expect.objectContaining({ occursAt: "2026-10-05T22:00:00.000Z" }),
      mockDb,
    );
    expect(enqueuedPayload()).toEqual({
      tripId: "trip-1",
      title: "Museu",
      occursAt: "2026-10-05T22:00:00.000Z",
    });
  });
});
