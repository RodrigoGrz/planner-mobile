import { tripServer } from "@/server/trip-server";
import { api } from "@/server/api";

jest.mock("@/server/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
    put: jest.fn(),
  },
}));

describe("tripServer routes", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create the trip with POST /trips", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { tripId: "trip-1" } });

    const result = await tripServer.create({
      destination: "Paris",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
      emails_to_invite: ["ana@example.com"],
    });

    expect(api.post).toHaveBeenCalledWith("/trips", {
      destination: "Paris",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
      emailsToInvite: ["ana@example.com"],
    });
    expect(result).toEqual({ tripId: "trip-1" });
  });

  it("should update the trip with PUT /trips/:tripId", async () => {
    (api.put as jest.Mock).mockResolvedValue({});

    await tripServer.update({
      tripId: "trip-1",
      destination: "Roma",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
    });

    expect(api.put).toHaveBeenCalledWith("/trips/trip-1", {
      destination: "Roma",
      startsAt: "2026-10-01T00:00:00.000Z",
      endsAt: "2026-10-05T00:00:00.000Z",
    });
  });

  it("should fetch the traveler trips with GET /me/trips", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { trips: [] } });

    await tripServer.getAllTripsByTraveler();

    expect(api.get).toHaveBeenCalledWith("/me/trips");
  });

  it("should fetch the next trip with GET /me/trips/next", async () => {
    (api.get as jest.Mock).mockResolvedValue({ data: { nextTrip: null } });

    await tripServer.getNextTripsByTraveler();

    expect(api.get).toHaveBeenCalledWith("/me/trips/next");
  });
});

describe("tripServer.uploadTripImage", () => {
  it("should upload the cover as a JPEG file", async () => {
    (api.put as jest.Mock).mockResolvedValue({});
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    await tripServer.uploadTripImage("trip-1", "file:///cache/converted.jpg");

    expect(api.put).toHaveBeenCalledTimes(1);
    const [route, formData, config] = (api.put as jest.Mock).mock.calls[0];
    expect(route).toBe("/trips/trip-1/cover-image");
    expect(formData).toBeInstanceOf(FormData);
    expect(config).toEqual({ headers: { "Content-Type": "multipart/form-data" } });
    expect(appendSpy).toHaveBeenCalledWith("file", {
      uri: "file:///cache/converted.jpg",
      name: "cover.jpg",
      type: "image/jpeg",
    });

    appendSpy.mockRestore();
  });
});

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
