import { getTripStatus } from "@/utils/trip-status";

describe("getTripStatus in Sao Paulo", () => {
  afterEach(() => {
    jest.useRealTimers();
  });

  function at(localDate: Date) {
    jest.useFakeTimers({ now: localDate });
  }

  it("should label a trip that starts today as in progress at 22h in Sao Paulo", () => {
    at(new Date(2026, 9, 1, 22, 0, 0));

    expect(
      getTripStatus("2026-10-01T00:00:00.000Z", "2026-10-03T00:00:00.000Z").label,
    ).toBe("Em andamento");
  });

  it("should label a trip that ends today as in progress in the morning", () => {
    at(new Date(2026, 9, 3, 8, 0, 0));

    expect(
      getTripStatus("2026-10-01T00:00:00.000Z", "2026-10-03T00:00:00.000Z").label,
    ).toBe("Em andamento");
  });

  it("should label a future trip as pending", () => {
    at(new Date(2026, 8, 30, 23, 0, 0));

    expect(
      getTripStatus("2026-10-01T00:00:00.000Z", "2026-10-03T00:00:00.000Z").label,
    ).toBe("Pendente");
  });

  it("should label a past trip as done", () => {
    at(new Date(2026, 9, 4, 0, 30, 0));

    expect(
      getTripStatus("2026-10-01T00:00:00.000Z", "2026-10-03T00:00:00.000Z").label,
    ).toBe("Realizada");
  });
});
