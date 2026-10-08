import { activitiesServer } from "@/server/activities-server";
import { api } from "@/server/api";

jest.mock("@/server/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

const activity = {
  tripId: "trip-1",
  title: "Museu",
  occursAt: "2026-10-02T14:00:00.000Z",
};

describe("activitiesServer.create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should return the activity id from the api response", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { activityId: "activity-remote-1" },
    });

    const response = await activitiesServer.create(activity);

    expect(response).toEqual({ activityId: "activity-remote-1" });
  });

  it("should create the activity with POST /trips/:tripId/activities without tripId in the body", async () => {
    (api.post as jest.Mock).mockResolvedValue({
      data: { activityId: "activity-remote-1" },
    });

    await activitiesServer.create(activity);

    expect(api.post).toHaveBeenCalledWith("/trips/trip-1/activities", {
      title: "Museu",
      occursAt: "2026-10-02T14:00:00.000Z",
    });
  });

  it("should return null when the api response has no activity id", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: "" });

    const response = await activitiesServer.create(activity);

    expect(response).toEqual({ activityId: null });
  });

  it("should return null when the activity id is an empty string", async () => {
    (api.post as jest.Mock).mockResolvedValue({ data: { activityId: "" } });

    const response = await activitiesServer.create(activity);

    expect(response).toEqual({ activityId: null });
  });
});
