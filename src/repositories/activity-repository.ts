import dayjs from "dayjs";

import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { ActivityProps } from "@/components/activity";

type ActivityRow = {
  id: string;
  trip_id: string;
  title: string;
  occurs_at: string;
};

type ActivityDayGroup = {
  date: string;
  activities: {
    id: string;
    title: string;
    occursAt: string;
  }[];
};

export type ActivitySection = {
  title: {
    dayNumber: number;
    dayName: string;
  };
  data: ActivityProps[];
};

function mapToSections(rows: ActivityRow[]): ActivitySection[] {
  const grouped = new Map<string, ActivityRow[]>();

  for (const row of rows) {
    const dateKey = dayjs(row.occurs_at).format("YYYY-MM-DD");
    const existing = grouped.get(dateKey) ?? [];
    existing.push(row);
    grouped.set(dateKey, existing);
  }

  return Array.from(grouped.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, activities]) => ({
      title: {
        dayNumber: dayjs(date).date(),
        dayName: dayjs(date).format("dddd").replace("-feira", ""),
      },
      data: activities
        .sort((a, b) => dayjs(a.occurs_at).valueOf() - dayjs(b.occurs_at).valueOf())
        .map((activity) => ({
          id: activity.id,
          title: activity.title,
          hour: dayjs(activity.occurs_at).format("hh[:]mm[h]"),
          isBefore: dayjs(activity.occurs_at).isBefore(dayjs()),
        })),
    }));
}

export async function getActivitiesByTripIdGrouped(tripId: string) {
  const db = await getDatabase();

  const rows = await db.getAllAsync<ActivityRow>(
    "SELECT * FROM activities WHERE trip_id = ? ORDER BY occurs_at ASC",
    [tripId],
  );

  return mapToSections(rows);
}

export async function replaceActivitiesByTripId(
  tripId: string,
  activities: ActivityDayGroup[],
) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM activities WHERE trip_id = ?", [tripId]);

    for (const day of activities) {
      for (const activity of day.activities) {
        await db.runAsync(
          "INSERT INTO activities (id, trip_id, title, occurs_at) VALUES (?, ?, ?, ?)",
          [activity.id, tripId, activity.title, activity.occursAt],
        );
      }
    }
  });

  await setSyncMetadata(`activities:${tripId}`);
}
