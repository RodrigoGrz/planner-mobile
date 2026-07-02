import { renderHook, waitFor } from "@testing-library/react-native";
import { hasSynced } from "@/database/has-synced";
import { getTripById } from "@/repositories/trip-repository";

let mockIsOnline = true;
const tripDataUpdatedListeners: Array<() => void> = [];

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: mockIsOnline,
    reconnectSignal: 0,
    registerReconnectCallback: jest.fn(() => jest.fn()),
  }),
}));

jest.mock("@/database/has-synced", () => ({
  hasSynced: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  getTripById: jest.fn(),
}));

jest.mock("@/services/trip-sync-events", () => ({
  subscribeTripDataUpdated: jest.fn((_tripId: string, listener: () => void) => {
    tripDataUpdatedListeners.push(listener);
    return () => {
      const index = tripDataUpdatedListeners.indexOf(listener);
      if (index >= 0) {
        tripDataUpdatedListeners.splice(index, 1);
      }
    };
  }),
}));

import { useTrip } from "@/hooks/useTrip";

describe("useTrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tripDataUpdatedListeners.length = 0;
    mockIsOnline = true;
  });

  it("should show ready when online without local cache", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(false);
    (getTripById as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    expect(result.current.trip).toBeNull();
  });

  it("should refresh from local data when trip data updates", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(false);
    (getTripById as jest.Mock)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({
        id: "t1",
        destination: "Paris",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-01-10T00:00:00.000Z"),
        ownerName: "Ana",
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        updatedAt: new Date("2025-12-01T00:00:00.000Z"),
      });

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.status).toBe("loading");
    });

    tripDataUpdatedListeners.forEach((listener) => listener());

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
      expect(result.current.trip?.destination).toBe("Paris");
    });
  });

  it("should skip api sync when offline with cache", async () => {
    mockIsOnline = false;

    (hasSynced as jest.Mock).mockResolvedValue(true);
    (getTripById as jest.Mock).mockResolvedValue({
      id: "t1",
      destination: "Paris",
      startsAt: new Date("2026-01-01T00:00:00.000Z"),
      endsAt: new Date("2026-01-10T00:00:00.000Z"),
      ownerName: "Ana",
      createdAt: new Date("2025-12-01T00:00:00.000Z"),
      updatedAt: new Date("2025-12-01T00:00:00.000Z"),
    });

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.status).toBe("offline");
    });
  });
});
