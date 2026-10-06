import { act, renderHook, waitFor } from "@testing-library/react-native";
import { hasSynced } from "@/database/has-synced";
import {
  getTripById,
  isTripInvitePending,
} from "@/repositories/trip-repository";

let mockIsOnline = true;
const tripDataUpdatedListeners: Array<() => void> = [];
const mockTripRemovedListeners: Array<{ tripId: string; listener: () => void }> =
  [];

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
  isTripInvitePending: jest.fn(() => Promise.resolve(false)),
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
  subscribeTripRemoved: jest.fn((tripId: string, listener: () => void) => {
    mockTripRemovedListeners.push({ tripId, listener });
    return () => {
      const index = mockTripRemovedListeners.findIndex(
        (entry) => entry.listener === listener,
      );
      if (index >= 0) {
        mockTripRemovedListeners.splice(index, 1);
      }
    };
  }),
}));

function notifyMockTripRemoved(tripId: string) {
  mockTripRemovedListeners
    .filter((entry) => entry.tripId === tripId)
    .forEach((entry) => entry.listener());
}

import { useTrip } from "@/hooks/useTrip";

describe("useTrip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    tripDataUpdatedListeners.length = 0;
    mockTripRemovedListeners.length = 0;
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

  it("should expose a pending invite", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);
    (getTripById as jest.Mock).mockResolvedValue(null);
    (isTripInvitePending as jest.Mock).mockResolvedValueOnce(true);

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.isInvitePending).toBe(true);
    });
    expect(isTripInvitePending).toHaveBeenCalledWith("t1");
  });

  it("should update the pending invite after the trip data updates", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);
    (getTripById as jest.Mock).mockResolvedValue(null);
    (isTripInvitePending as jest.Mock)
      .mockResolvedValueOnce(true)
      .mockResolvedValueOnce(false);

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.isInvitePending).toBe(true);
    });

    act(() => {
      tripDataUpdatedListeners.forEach((listener) => listener());
    });

    await waitFor(() => {
      expect(result.current.isInvitePending).toBe(false);
    });
  });

  it("should flag the trip as removed when its removal is notified", async () => {
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
      expect(result.current.trip?.destination).toBe("Paris");
    });
    expect(result.current.isRemoved).toBe(false);

    act(() => {
      notifyMockTripRemoved("t1");
    });

    expect(result.current.isRemoved).toBe(true);
    expect(result.current.trip).toBeNull();
  });

  it("should clear the removed flag when the trip id changes", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);
    (getTripById as jest.Mock).mockResolvedValue(null);

    const { result, rerender } = renderHook(
      ({ tripId }: { tripId: string }) => useTrip(tripId),
      { initialProps: { tripId: "t1" } },
    );

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    act(() => {
      notifyMockTripRemoved("t1");
    });
    expect(result.current.isRemoved).toBe(true);

    rerender({ tripId: "t2" });

    await waitFor(() => {
      expect(result.current.isRemoved).toBe(false);
    });
  });

  it("should not flag the trip as removed when another trip is removed", async () => {
    (hasSynced as jest.Mock).mockResolvedValue(true);
    (getTripById as jest.Mock).mockResolvedValue(null);

    const { result } = renderHook(() => useTrip("t1"));

    await waitFor(() => {
      expect(result.current.status).toBe("ready");
    });

    act(() => {
      notifyMockTripRemoved("t2");
    });

    expect(result.current.isRemoved).toBe(false);
  });
});
