import {
  MAX_TRIP_DURATION_IN_DAYS,
  compareTripDayWithToday,
  exceedsMaxTripDuration,
  getTripPeriodUpdateError,
  getLocalTodayString,
  isValidActivityHour,
  isWallClockPast,
  toApiActivityDateTime,
  toApiTripDate,
  toTripDayString,
  tripDayjs,
} from "@/utils/trip-dates";

describe("trip-dates in America/Sao_Paulo", () => {
  it("should run the suite in the Sao Paulo timezone", () => {
    expect(new Date(2026, 9, 1).toISOString()).toBe("2026-10-01T03:00:00.000Z");
  });

  it("should send a trip day as midnight UTC without shifting the day", () => {
    expect(toApiTripDate("2026-10-01")).toBe("2026-10-01T00:00:00.000Z");
  });

  it("should reject a trip date that is not YYYY-MM-DD", () => {
    expect(() => toApiTripDate("2026-10-01T03:00:00.000Z")).toThrow(RangeError);
    expect(() => toApiTripDate("")).toThrow(RangeError);
  });

  it("should send an activity wall clock time without shifting the hour", () => {
    expect(toApiActivityDateTime("2026-10-05", 22)).toBe(
      "2026-10-05T22:00:00.000Z",
    );
  });

  it("should pad single digit activity hours", () => {
    expect(toApiActivityDateTime("2026-10-05", 7)).toBe(
      "2026-10-05T07:00:00.000Z",
    );
  });

  it.each([-1, 24, 1.5, NaN])("should reject the activity hour %p", (hour) => {
    expect(isValidActivityHour(hour)).toBe(false);
    expect(() => toApiActivityDateTime("2026-10-05", hour)).toThrow(RangeError);
  });

  it("should accept activity hours from 0 to 23", () => {
    expect(isValidActivityHour(0)).toBe(true);
    expect(isValidActivityHour(23)).toBe(true);
  });

  it("should read the trip day in UTC instead of the local day", () => {
    expect(toTripDayString("2026-10-01T00:00:00.000Z")).toBe("2026-10-01");
    expect(toTripDayString(new Date("2026-10-05T23:59:59.000Z"))).toBe(
      "2026-10-05",
    );
    expect(tripDayjs("2026-10-01T00:00:00.000Z").date()).toBe(1);
  });

  it("should return the local day as today late at night", () => {
    const localLateNight = new Date(2026, 9, 1, 22, 0, 0);

    expect(getLocalTodayString(localLateNight)).toBe("2026-10-01");
  });

  it("should compare activity wall clock time with the local time", () => {
    const localTwoPm = new Date(2026, 9, 1, 14, 0, 0);

    expect(isWallClockPast("2026-10-01T13:00:00.000Z", localTwoPm)).toBe(true);
    expect(isWallClockPast("2026-10-01T15:00:00.000Z", localTwoPm)).toBe(false);
  });

  it("should be during the trip on its first day at 22h", () => {
    const firstDayAt22h = new Date(2026, 9, 1, 22, 0, 0);

    expect(
      compareTripDayWithToday(
        "2026-10-01T00:00:00.000Z",
        "2026-10-03T00:00:00.000Z",
        firstDayAt22h,
      ),
    ).toBe("during");
  });

  it("should be during the trip on its last day", () => {
    const lastDayMorning = new Date(2026, 9, 3, 8, 0, 0);

    expect(
      compareTripDayWithToday(
        "2026-10-01T00:00:00.000Z",
        "2026-10-03T00:00:00.000Z",
        lastDayMorning,
      ),
    ).toBe("during");
  });

  it("should accept a trip of exactly 30 days", () => {
    expect(exceedsMaxTripDuration("2026-10-01", "2026-10-31")).toBe(false);
    expect(exceedsMaxTripDuration("2026-10-20", "2026-11-19")).toBe(false);
  });

  it("should reject a trip longer than 30 days", () => {
    expect(exceedsMaxTripDuration("2026-10-01", "2026-11-01")).toBe(true);
    expect(MAX_TRIP_DURATION_IN_DAYS).toBe(30);
  });

  describe("getTripPeriodUpdateError", () => {
    const today = new Date(2030, 9, 3, 10, 0, 0);
    const current = { currentStartsAt: "2030-10-01", currentEndsAt: "2030-10-05" };

    it("should accept an unchanged start date in the past", () => {
      expect(
        getTripPeriodUpdateError(
          { startsAt: "2030-10-01", endsAt: "2030-10-06", ...current },
          today,
        ),
      ).toBeNull();
    });

    it("should reject a changed start date before today", () => {
      expect(
        getTripPeriodUpdateError(
          { startsAt: "2030-10-02", endsAt: "2030-10-05", ...current },
          today,
        ),
      ).toBe("A data de início não pode ser anterior a hoje.");
    });

    it("should reject a changed end date before today", () => {
      expect(
        getTripPeriodUpdateError(
          { startsAt: "2030-10-01", endsAt: "2030-10-02", ...current },
          today,
        ),
      ).toBe("A data de fim não pode ser anterior a hoje.");
    });

    it("should reject an updated period longer than 30 days", () => {
      expect(
        getTripPeriodUpdateError(
          { startsAt: "2030-10-01", endsAt: "2030-11-01", ...current },
          today,
        ),
      ).toBe("A viagem pode ter no máximo 30 dias.");
    });
  });

  it("should be before and after the trip outside its days", () => {
    expect(
      compareTripDayWithToday(
        "2026-10-01T00:00:00.000Z",
        "2026-10-03T00:00:00.000Z",
        new Date(2026, 8, 30, 23, 0, 0),
      ),
    ).toBe("before");
    expect(
      compareTripDayWithToday(
        "2026-10-01T00:00:00.000Z",
        "2026-10-03T00:00:00.000Z",
        new Date(2026, 9, 4, 0, 30, 0),
      ),
    ).toBe("after");
  });
});
