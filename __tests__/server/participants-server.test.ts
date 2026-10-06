import { api } from "@/server/api";
import { participantsServer } from "@/server/participants-server";

jest.mock("@/server/api", () => ({
  api: {
    get: jest.fn(),
    patch: jest.fn(),
  },
}));

describe("participantsServer", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should fetch the participants of a trip", async () => {
    const participants = [
      { id: "p1", name: "Ana", email: "ana@example.com", isConfirmed: true },
    ];
    (api.get as jest.Mock).mockResolvedValue({ data: { participants } });

    const result = await participantsServer.getByTripId("trip-1");

    expect(api.get).toHaveBeenCalledWith("/trips/trip-1/participants");
    expect(result).toEqual(participants);
  });

  it("should not expose the legacy attendance confirmation", () => {
    expect(participantsServer).not.toHaveProperty("confirmTripByParticipantId");
  });
});
