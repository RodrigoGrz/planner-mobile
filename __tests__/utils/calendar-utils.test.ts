import { calendarUtils } from "@/utils/calendarUtils";

jest.mock("react-native-calendars", () => ({
  CalendarUtils: { getCalendarDateString: jest.fn() },
}));

describe("calendarUtils.toCalendarDate", () => {
  it("should build the calendar date from the UTC trip day", () => {
    expect(calendarUtils.toCalendarDate("2026-10-01T00:00:00.000Z")).toEqual({
      dateString: "2026-10-01",
      day: 1,
      month: 10,
      year: 2026,
      timestamp: Date.UTC(2026, 9, 1),
    });
  });

  it("should accept a Date as the trip day", () => {
    expect(
      calendarUtils.toCalendarDate(new Date("2026-10-05T00:00:00.000Z"))
        .dateString,
    ).toBe("2026-10-05");
  });
});
