import { SQLiteDatabase } from "expo-sqlite";
import dayjs from "dayjs";

import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { ActivityProps } from "@/components/activity";
import { EntitySyncStatus } from "@/types/sync";
import { resolveLocalTripId, resolveAllTripIds } from "@/repositories/trip-repository";

type ActivityRow = {
  id: string;
  trip_id: string;
  title: string;
  occurs_at: string;
  remote_id: string | null;
  sync_status: EntitySyncStatus;
  last_sync_error: string | null;
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

function activitiesMatchSameEntity(a: ActivityRow, b: ActivityRow) {
  if (a.id === b.id) {
    return true;
  }

  const aRemote = a.remote_id;
  const bRemote = b.remote_id;

  if (aRemote && (aRemote === b.id || aRemote === bRemote)) {
    return true;
  }

  if (bRemote && bRemote === a.id) {
    return true;
  }

  return a.title === b.title && a.occurs_at === b.occurs_at;
}

function pickPreferredActivityRow(current: ActivityRow, candidate: ActivityRow) {
  if (current.sync_status !== "synced" && candidate.sync_status === "synced") {
    return candidate;
  }

  if (candidate.sync_status !== "synced" && current.sync_status === "synced") {
    return current;
  }

  if (!current.remote_id && candidate.remote_id) {
    return candidate;
  }

  return current;
}

function dedupeActivityRows(rows: ActivityRow[]) {
  const deduped: ActivityRow[] = [];

  for (const row of rows) {
    const matchIndex = deduped.findIndex((existing) =>
      activitiesMatchSameEntity(existing, row),
    );

    if (matchIndex === -1) {
      deduped.push(row);
      continue;
    }

    deduped[matchIndex] = pickPreferredActivityRow(deduped[matchIndex], row);
  }

  return deduped;
}

function mapToSections(rows: ActivityRow[]): ActivitySection[] {
  const grouped = new Map<string, ActivityRow[]>();

  for (const row of dedupeActivityRows(rows)) {
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
          syncStatus: activity.sync_status,
        }))
        .filter(
          (activity, index, items) =>
            items.findIndex((item) => item.id === activity.id) === index,
        ),
    }));
}

export async function getActivitiesByTripIdGrouped(tripId: string) {
  const db = await getDatabase();
  const relatedTripIds = await resolveAllTripIds(tripId);
  const placeholders = relatedTripIds.map(() => "?").join(", ");

  const rows = await db.getAllAsync<ActivityRow>(
    `SELECT * FROM activities WHERE trip_id IN (${placeholders}) ORDER BY occurs_at ASC`,
    relatedTripIds,
  );

  return mapToSections(rows);
}

export async function insertLocalActivity(
  {
    id,
    tripId,
    title,
    occursAt,
  }: {
    id: string;
    tripId: string;
    title: string;
    occursAt: string;
  },
  dbOverride?: SQLiteDatabase,
) {
  const localTripId = await resolveLocalTripId(tripId);
  const db = dbOverride ?? (await getDatabase());

  await db.runAsync(
    `INSERT INTO activities
     (id, trip_id, title, occurs_at, remote_id, sync_status, last_sync_error)
     VALUES (?, ?, ?, ?, NULL, 'pending', NULL)`,
    [id, localTripId, title, occursAt],
  );
}

export async function getStoredActivityRemoteId(entityId: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ remote_id: string | null }>(
    "SELECT remote_id FROM activities WHERE id = ? OR remote_id = ?",
    [entityId, entityId],
  );

  return row?.remote_id ?? null;
}

export async function resetActivitySyncStatus(localId: string, status: EntitySyncStatus) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE activities SET sync_status = ?, last_sync_error = NULL WHERE id = ?`,
    [status, localId],
  );
}

export async function updateActivityRemoteIdAfterSync(
  localId: string,
  remoteId: string,
) {
  const db = await getDatabase();

  if (localId === remoteId) {
    await db.runAsync(
      `UPDATE activities
       SET remote_id = ?, sync_status = 'synced', last_sync_error = NULL
       WHERE id = ?`,
      [remoteId, localId],
    );
    return;
  }

  await db.withTransactionAsync(async () => {
    const activity = await db.getFirstAsync<ActivityRow>(
      "SELECT * FROM activities WHERE id = ?",
      [localId],
    );

    if (!activity) {
      return;
    }

    await db.runAsync(
      `INSERT INTO activities
       (id, trip_id, title, occurs_at, remote_id, sync_status, last_sync_error)
       VALUES (?, ?, ?, ?, ?, 'synced', NULL)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         occurs_at = excluded.occurs_at,
         remote_id = excluded.remote_id,
         sync_status = 'synced',
         last_sync_error = NULL`,
      [
        remoteId,
        activity.trip_id,
        activity.title,
        activity.occurs_at,
        remoteId,
      ],
    );

    await db.runAsync(
      "UPDATE sync_queue SET entity_id = ? WHERE entity_id = ? AND entity_type = 'activity'",
      [remoteId, localId],
    );
    await db.runAsync("DELETE FROM activities WHERE id = ?", [localId]);
  });
}

export async function markActivitySyncFailed(localId: string, errorMessage: string) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE activities SET sync_status = 'failed', last_sync_error = ? WHERE id = ?`,
    [errorMessage, localId],
  );
}

export async function markActivitySyncing(localId: string) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE activities SET sync_status = 'syncing', last_sync_error = NULL WHERE id = ?`,
    [localId],
  );
}

export async function mergeActivitiesFromServer(
  tripId: string,
  activities: ActivityDayGroup[],
) {
  const db = await getDatabase();
  const localTripId = await resolveLocalTripId(tripId);
  const relatedTripIds = await resolveAllTripIds(tripId);
  const serverActivities = activities.flatMap((day) => day.activities);

  await db.withTransactionAsync(async () => {
    for (const relatedTripId of relatedTripIds) {
      if (relatedTripId !== localTripId) {
        await db.runAsync(
          "UPDATE activities SET trip_id = ? WHERE trip_id = ?",
          [localTripId, relatedTripId],
        );
      }
    }

    await db.runAsync(
      "DELETE FROM activities WHERE trip_id = ? AND sync_status = 'synced'",
      [localTripId],
    );

    for (const activity of serverActivities) {
      await db.runAsync(
        `DELETE FROM activities
         WHERE trip_id = ?
         AND id != ?
         AND (remote_id = ? OR id = ?)`,
        [localTripId, activity.id, activity.id, activity.id],
      );

      await db.runAsync(
        `INSERT INTO activities
         (id, trip_id, title, occurs_at, remote_id, sync_status, last_sync_error)
         VALUES (?, ?, ?, ?, ?, 'synced', NULL)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           occurs_at = excluded.occurs_at,
           remote_id = excluded.remote_id,
           trip_id = excluded.trip_id,
           sync_status = CASE
             WHEN activities.sync_status IN ('pending', 'syncing', 'failed') THEN activities.sync_status
             ELSE 'synced'
           END`,
        [activity.id, localTripId, activity.title, activity.occursAt, activity.id],
      );
    }
  });

  for (const relatedTripId of relatedTripIds) {
    await setSyncMetadata(`activities:${relatedTripId}`);
  }
}

/** @deprecated Use mergeActivitiesFromServer */
export async function replaceActivitiesByTripId(
  tripId: string,
  activities: ActivityDayGroup[],
) {
  await mergeActivitiesFromServer(tripId, activities);
}