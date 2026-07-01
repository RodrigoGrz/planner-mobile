import { renderHook, waitFor } from "@testing-library/react-native";
import { hasSynced } from "@/database/has-synced";
import { getTripById } from "@/repositories/trip-repository";
import { syncTripDetail } from "@/services/sync-service";

let mockIsOnline = true;

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: mockIsOnline,
    registerReconnectCallback: jest.fn(() => jest.fn()),
  }),
}));

jest.mock("@/database/has-synced", () => ({
  hasSynced: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  getTripById: jest.fn(),
}));

jest.mock("@/services/sync-service", () => ({
  syncTripDetail: jest.fn(),
}));

jest.mock("@/services/trip-sync-events", () => ({
  subscribeTripDataUpdated: jest.fn(() => jest.fn()),
}));

import { useTrip } from "@/hooks/useTrip";

describe("useTrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
  });

  it("should sync from api when there is no local cache", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(false);
    (getTripById as jest.Mock).mockResolvedValue(null);
    (syncTripDetail as jest.Mock).mockImplementation(async () => {
      (getTripById as jest.Mock).mockResolvedValue({
        id: "t1",
        destination: "Paris",
        startsAt: new Date("2026-01-01T00:00:00.000Z"),
        endsAt: new Date("2026-01-10T00:00:00.000Z"),
        ownerName: "Ana",
        createdAt: new Date("2025-12-01T00:00:00.000Z"),
        updatedAt: new Date("2025-12-01T00:00:00.000Z"),
      });
    });

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(syncTripDetail).toHaveBeenCalledWith("t1");
    });

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

    expect(syncTripDetail).not.toHaveBeenCalled();
  });
});
