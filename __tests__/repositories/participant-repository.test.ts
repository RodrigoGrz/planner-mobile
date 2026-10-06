import { getParticipantsByTripId } from "@/repositories/participant-repository";

const mockGetAllAsync = jest.fn();

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      getAllAsync: mockGetAllAsync,
    }),
  ),
}));

jest.mock("@/database/sync-metadata", () => ({
  setSyncMetadata: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  resolveLocalTripId: jest.fn((tripId: string) => Promise.resolve(tripId)),
}));

describe("participant-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should keep a null participant name", async () => {
    mockGetAllAsync.mockResolvedValue([
      {
        id: "p1",
        trip_id: "trip-1",
        name: null,
        email: "ana@example.com",
        is_confirmed: 0,
      },
    ]);

    const participants = await getParticipantsByTripId("trip-1");

    expect(participants).toEqual([
      { id: "p1", name: null, email: "ana@example.com", isConfirmed: false },
    ]);
  });
});
