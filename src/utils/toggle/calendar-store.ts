import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Calendar from "expo-calendar";
import { createCalendar } from "./calendar-sync";

const CALENDAR_ID_KEY = "@planner:calendarId";

export async function getOrCreateCalendarId(): Promise<string> {
  const storedCalendarId = await AsyncStorage.getItem(CALENDAR_ID_KEY);

  if (storedCalendarId) {
    return storedCalendarId;
  }

  const calendars = await Calendar.getCalendarsAsync(
    Calendar.EntityTypes.EVENT,
  );

  const existingCalendar = calendars.find((c) => c.title === "Planner");

  if (existingCalendar) {
    await AsyncStorage.setItem(CALENDAR_ID_KEY, existingCalendar.id);
    return existingCalendar.id;
  }

  const calendarId = await createCalendar();
  await AsyncStorage.setItem(CALENDAR_ID_KEY, calendarId);

  return calendarId;
}
