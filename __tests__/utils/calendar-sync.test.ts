import * as Calendar from "expo-calendar";

import { syncTripWithCalendar } from "@/utils/toggle/calendar-sync";

jest.mock("expo-calendar", () => ({
  createEventAsync: jest.fn(),
  createCalendarAsync: jest.fn(),
  getDefaultCalendarAsync: jest.fn(),
  EntityTypes: { EVENT: "event" },
}));

jest.mock("@/utils/toggle/calendar-store", () => ({
  getOrCreateCalendarId: jest.fn(() => Promise.resolve("calendar-1")),
}));

function localDay(date: Date) {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");

  return `${date.getFullYear()}-${month}-${day}`;
}

function createdEvents() {
  return (Calendar.createEventAsync as jest.Mock).mock.calls.map(
    ([, event]) => event,
  );
}

describe("syncTripWithCalendar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create one all-day event per trip day on the local calendar days", async () => {
    await syncTripWithCalendar({
      destination: "Paris",
      startsAt: "2030-10-01",
      endsAt: "2030-10-05",
    });

    const events = createdEvents();

    expect(events.map((event) => localDay(event.startDate))).toEqual([
      "2030-10-01",
      "2030-10-02",
      "2030-10-03",
      "2030-10-04",
      "2030-10-05",
    ]);
  });

  it("should start each event at local midnight and end at the next local midnight", async () => {
    await syncTripWithCalendar({
      destination: "Paris",
      startsAt: "2030-10-01",
      endsAt: "2030-10-01",
    });

    const [event] = createdEvents();

    expect(event).toMatchObject({ allDay: true, title: "Viagem: Paris" });
    expect(event.startDate.getHours()).toBe(0);
    expect(localDay(event.endDate)).toBe("2030-10-02");
    expect(event.endDate.getHours()).toBe(0);
  });
});
