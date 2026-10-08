import { linksServer } from "@/server/links-server";
import { api } from "@/server/api";

jest.mock("@/server/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

const link = {
  tripId: "trip-1",
  title: "Reserva",
  url: "https://example.com/reserva",
};

describe("linksServer.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the link id from the api response", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { linkId: "link-remote-1" },
    });

    const response = await linksServer.create(link);

    expect(response).toEqual({ linkId: "link-remote-1" });
  });

  it("should create the link with POST /trips/:tripId/links without tripId in the body", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { linkId: "link-remote-1" },
    });

    await linksServer.create(link);

    expect(api.post).toHaveBeenCalledWith("/trips/trip-1/links", {
      title: "Reserva",
      url: "https://example.com/reserva",
    });
  });

  it("should return null when the api response has no link id", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: "" });

    const response = await linksServer.create(link);

    expect(response).toEqual({ linkId: null });
  });

  it("should return null when the link id is not a string", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { linkId: 42 } });

    const response = await linksServer.create(link);

    expect(response).toEqual({ linkId: null });
  });
});
