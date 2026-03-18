import { colors } from "@/styles/colors";
import * as Calendar from "expo-calendar";
import { Platform } from "react-native";
import { getOrCreateCalendarId } from "./calendar-store";

interface SyncTripWithCalendarProps {
  destination: string;
  startsAt: string;
  endsAt: string;
}

const CALENDAR_TITLE = "Planner";

export async function syncTripWithCalendar({
  destination,
  startsAt,
  endsAt,
}: SyncTripWithCalendarProps) {
  const calendarId = await getOrCreateCalendarId();

  const startDate = new Date(startsAt);
  const endDate = new Date(endsAt);

  const currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayStart = new Date(currentDate);

    const dayEnd = new Date(currentDate);
    dayEnd.setDate(dayEnd.getDate() + 1);
    dayEnd.setHours(0, 0, 0, 0);

    await Calendar.createEventAsync(calendarId, {
      allDay: true,
      title: `Viagem: ${destination}`,
      startDate: dayStart,
      endDate: dayEnd,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    currentDate.setDate(currentDate.getDate() + 1);
  }
}

async function getDefaultCalendarSource() {
  const defaultCalendar = await Calendar.getDefaultCalendarAsync();

  return defaultCalendar.source;
}

export async function createCalendar() {
  const defaultCalendarSource =
    Platform.OS === "ios"
      ? await getDefaultCalendarSource()
      : ({ isLocalAccount: true, name: CALENDAR_TITLE } as Calendar.Source);

  const newCalendarID = await Calendar.createCalendarAsync({
    title: CALENDAR_TITLE,
    color: colors.lime[300],
    entityType: Calendar.EntityTypes.EVENT,
    sourceId: defaultCalendarSource.id,
    source: defaultCalendarSource,
    name: CALENDAR_TITLE.toLowerCase(),
    ownerAccount: "personal",
    accessLevel: Calendar.CalendarAccessLevel.OWNER,
  });

  return newCalendarID;
}
