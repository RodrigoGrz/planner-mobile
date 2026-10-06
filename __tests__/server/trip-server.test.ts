import { tripServer } from "@/server/trip-server";
import { api } from "@/server/api";

jest.mock("@/server/api", () => ({
  api: {
    get: jest.fn(),
    post: jest.fn(),
  },
}));

describe("tripServer.uploadTripImage", () => {
  it("should upload the cover as a JPEG file", async () => {
    (api.post as jest.Mock).mockResolvedValue({});
    const appendSpy = jest.spyOn(FormData.prototype, "append");

    await tripServer.uploadTripImage("trip-1", "file:///cache/converted.jpg");

    const [route, formData, config] = (api.post as jest.Mock).mock.calls[0];
    expect(route).toBe("/trips/trip-1/image");
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
