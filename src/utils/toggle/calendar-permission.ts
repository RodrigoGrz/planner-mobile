import * as Calendar from "expo-calendar";

export async function calendarPermission() {
  const { status } = await Calendar.requestCalendarPermissionsAsync();
  return status === "granted";
}
