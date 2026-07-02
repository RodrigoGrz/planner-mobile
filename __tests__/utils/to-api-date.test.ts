import { toApiDate } from "@/utils/to-api-date";

describe("toApiDate", () => {
  it("serializes dates as ISO strings", () => {
    expect(toApiDate("2026-03-01T10:00:00.000Z")).toBe(
      "2026-03-01T10:00:00.000Z",
    );
  });
});
