import { api } from "@/server/api";
import { registerServer } from "@/server/register-server";

jest.mock("@/server/api", () => ({
  api: {
    post: jest.fn(),
  },
}));

describe("registerServer", () => {
  it("should register the traveler with POST /travelers", async () => {
    (api.post as jest.Mock).mockResolvedValue({});

    await registerServer.registerTraveler({
      name: "Ana",
      email: "ana@example.com",
      password: "12345678",
      phone: "(67) 99999-9999",
    });

    expect(api.post).toHaveBeenCalledWith("/travelers", {
      name: "Ana",
      email: "ana@example.com",
      password: "12345678",
      phone: "(67) 99999-9999",
    });
  });
});
