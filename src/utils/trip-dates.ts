import dayjs from "dayjs";
import utc from "dayjs/plugin/utc";

import { ERROR_MESSAGES } from "@/utils/error-messages";

dayjs.extend(utc);

export type TripDayPosition = "before" | "during" | "after";

export const MAX_TRIP_DURATION_IN_DAYS = 30;

export function exceedsMaxTripDuration(
  startDateString: string,
  endDateString: string,
) {
  const durationInDays = dayjs
    .utc(endDateString)
    .diff(dayjs.utc(startDateString), "day");

  return durationInDays > MAX_TRIP_DURATION_IN_DAYS;
}

const DATE_STRING_PATTERN = /^\d{4}-\d{2}-\d{2}$/;
const DAY_FORMAT = "YYYY-MM-DD";
const WALL_CLOCK_FORMAT = "YYYY-MM-DDTHH:mm:ss";

function assertDateString(dateString: string) {
  if (!DATE_STRING_PATTERN.test(dateString)) {
    throw new RangeError(`Invalid calendar day: ${dateString}`);
  }
}

export function tripDayjs(value: string | Date) {
  return dayjs.utc(value);
}

export function toApiTripDate(dateString: string) {
  assertDateString(dateString);

  return `${dateString}T00:00:00.000Z`;
}

export function isValidActivityHour(hour: number) {
  return Number.isInteger(hour) && hour >= 0 && hour <= 23;
}

export function toApiActivityDateTime(dateString: string, hour: number) {
  assertDateString(dateString);

  if (!isValidActivityHour(hour)) {
    throw new RangeError(`Invalid activity hour: ${hour}`);
  }

  return `${dateString}T${String(hour).padStart(2, "0")}:00:00.000Z`;
}

type TripPeriodUpdate = {
  startsAt: string;
  endsAt: string;
  currentStartsAt: string;
  currentEndsAt: string;
};

export function getTripPeriodUpdateError(
  { startsAt, endsAt, currentStartsAt, currentEndsAt }: TripPeriodUpdate,
  now: Date = new Date(),
): string | null {
  const today = getLocalTodayString(now);

  if (startsAt !== currentStartsAt && startsAt < today) {
    return ERROR_MESSAGES.startDateBeforeToday;
  }

  if (endsAt !== currentEndsAt && endsAt < today) {
    return ERROR_MESSAGES.endDateBeforeToday;
  }

  if (exceedsMaxTripDuration(startsAt, endsAt)) {
    return ERROR_MESSAGES.tripTooLong;
  }

  return null;
}

export function toTripDayString(value: string | Date) {
  return tripDayjs(value).format(DAY_FORMAT);
}

export function getLocalTodayString(now: Date = new Date()) {
  return dayjs(now).format(DAY_FORMAT);
}

export function isWallClockPast(value: string | Date, now: Date = new Date()) {
  const wallClockNow = dayjs.utc(dayjs(now).format(WALL_CLOCK_FORMAT));

  return tripDayjs(value).isBefore(wallClockNow);
}

export function compareTripDayWithToday(
  startsAt: string,
  endsAt: string,
  now: Date = new Date(),
): TripDayPosition {
  const today = getLocalTodayString(now);

  if (today < toTripDayString(startsAt)) {
    return "before";
  }

  if (today > toTripDayString(endsAt)) {
    return "after";
  }

  return "during";
}
