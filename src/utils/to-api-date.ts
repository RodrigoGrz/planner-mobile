import dayjs from "dayjs";

export function toApiDate(value: string | Date | dayjs.Dayjs): string {
  return dayjs(value).toISOString();
}
