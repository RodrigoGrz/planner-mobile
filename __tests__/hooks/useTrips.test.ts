import { renderHook, waitFor } from "@testing-library/react-native";
import { useTrips } from "@/hooks/useTrips";
import { hasSynced } from "@/database/has-synced";
import { syncTravelerTrips } from "@/services/sync-service";

const mockRegisterReconnectCallback = jest.fn(() => jest.fn());

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: false,
    registerReconnectCallback: mockRegisterReconnectCallback,
  }),
}));

jest.mock("@/database/has-synced", () => ({
  hasSynced: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  getTravelerTrips: jest.fn(() =>
    Promise.resolve([
      {
        participantId: "p1",
        tripId: "t1",
        destination: "Paris",
        startsAt: "2026-01-01T00:00:00.000Z",
        endsAt: "2026-01-10T00:00:00.000Z",
        isConfirmed: true,
        coverImageUrl: null,
      },
    ]),
  ),
  getNextTrip: jest.fn(() =>
    Promise.resolve({
      participantId: "p1",
      tripId: "t1",
      destination: "Paris",
      startsAt: "2026-01-01T00:00:00.000Z",
      endsAt: "2026-01-10T00:00:00.000Z",
      isConfirmed: true,
      coverImageUrl: null,
    }),
  ),
}));

jest.mock("@/services/sync-service", () => ({
  syncTravelerTrips: jest.fn(),
}));

describe("useTrips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should load cached trips when offline with cache", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.nextTrip?.tripId).toBe("t1");
    expect(syncTravelerTrips).not.toHaveBeenCalled();
  });

  it("should attempt sync when offline without cache", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(false);
    (syncTravelerTrips as jest.Mock).mockResolvedValue(undefined);

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(syncTravelerTrips).toHaveBeenCalled();
    });

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });
  });

  it("should set error when offline without cache and sync fails", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(false);
    (syncTravelerTrips as jest.Mock).mockRejectedValue(new Error("network"));

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(result.current.status).toBe("error");
    });
  });
});
