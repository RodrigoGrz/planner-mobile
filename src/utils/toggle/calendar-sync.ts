import { colors } from "@/styles/colors";
import dayjs from "dayjs";
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

  const lastDay = dayjs(endsAt).startOf("day");
  let currentDay = dayjs(startsAt).startOf("day");

  while (!currentDay.isAfter(lastDay)) {
    await Calendar.createEventAsync(calendarId, {
      allDay: true,
      title: `Viagem: ${destination}`,
      startDate: currentDay.toDate(),
      endDate: currentDay.add(1, "day").toDate(),
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone,
    });

    currentDay = currentDay.add(1, "day");
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
