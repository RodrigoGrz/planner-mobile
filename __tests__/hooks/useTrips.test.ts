import { renderHook, waitFor } from "@testing-library/react-native";
import { useTrips } from "@/hooks/useTrips";
import { hasSynced } from "@/database/has-synced";
import { subscribeSyncComplete } from "@/services/sync-engine";

let mockIsOnline = false;
const mockRegisterReconnectCallback = jest.fn(() => jest.fn());
const syncCompleteListeners: Array<() => void> = [];

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: mockIsOnline,
    reconnectSignal: 0,
    registerReconnectCallback: mockRegisterReconnectCallback,
  }),
}));

jest.mock("@/database/has-synced", () => ({
  hasSynced: jest.fn(),
}));

jest.mock("@/services/sync-engine", () => ({
  subscribeSyncComplete: jest.fn((listener: () => void) => {
    syncCompleteListeners.push(listener);
    return () => {
      const index = syncCompleteListeners.indexOf(listener);
      if (index >= 0) {
        syncCompleteListeners.splice(index, 1);
      }
    };
  }),
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

describe("useTrips", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    syncCompleteListeners.length = 0;
    mockIsOnline = false;
  });

  it("should load cached trips when offline with cache", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });

    expect(result.current.trips).toHaveLength(1);
    expect(result.current.nextTrip?.tripId).toBe("t1");
  });

  it("should show ready when online without local cache", async () => {
    mockIsOnline = true;

    const { getTravelerTrips, getNextTrip } = jest.requireMock(
      "@/repositories/trip-repository",
    );

    (getTravelerTrips as jest.Mock).mockResolvedValueOnce([]);
    (getNextTrip as jest.Mock).mockResolvedValueOnce(null);
    (hasSynced as jest.Mock).mockResolvedValue(false);

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.trips).toEqual([]);
  });

  it("should reload local data when sync completes while offline", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);

    const { result } = renderHook(() => useTrips());

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });

    syncCompleteListeners.forEach((listener) => listener());

    await waitFor(() => {
      expect(result.current.trips).toHaveLength(1);
    });
  });
});
