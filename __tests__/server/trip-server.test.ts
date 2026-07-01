import { tripServer } from "@/server/trip-server";
import { api } from "@/server/api";

jest.mock("@/server/api", () => ({
  api: {
    get: jest.fn(),
  },
}));

describe("tripServer.getById", () => {
  it("should parse string dates from api response", async () => {
    (api.get as jest.Mock).mockResolvedValue({
      data: {
        trip: {
          id: "t1",
          destination: "Paris",
          startsAt: "2026-01-01T00:00:00.000Z",
          endsAt: "2026-01-10T00:00:00.000Z",
          ownerName: "Ana",
          createdAt: "2025-12-01T00:00:00.000Z",
          updatedAt: "2025-12-01T00:00:00.000Z",
        },
      },
    });

    const trip = await tripServer.getById("t1");

    expect(trip.startsAt).toBeInstanceOf(Date);
    expect(trip.endsAt).toBeInstanceOf(Date);
    expect(trip.createdAt).toBeInstanceOf(Date);
    expect(trip.updatedAt).toBeInstanceOf(Date);
    expect(trip.destination).toBe("Paris");
  });
});
