import { SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { EntitySyncStatus } from "@/types/sync";
import { TripByID, TripDetails } from "@/server/trip-server";

type TravelerTripRow = {
  participant_id: string;
  trip_id: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  is_confirmed: number;
  cover_image_url: string | null;
  remote_id: string | null;
  sync_status: EntitySyncStatus;
  last_sync_error: string | null;
};

type TripRow = {
  id: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  cover_image_url: string | null;
  owner_name: string | null;
  created_at: string | null;
  updated_at: string | null;
  remote_id: string | null;
  sync_status: EntitySyncStatus;
  last_sync_error: string | null;
};

function mapTravelerTripRow(row: TravelerTripRow): TripDetails {
  return {
    participantId: row.participant_id,
    tripId: row.trip_id,
    destination: row.destination,
    startsAt: row.starts_at,
    endsAt: row.ends_at,
    isConfirmed: row.is_confirmed === 1,
    coverImageUrl: row.cover_image_url,
  };
}

function mapTripRow(row: TripRow): TripByID {
  return {
    id: row.id,
    destination: row.destination,
    startsAt: new Date(row.starts_at),
    endsAt: new Date(row.ends_at),
    coverImageUrl: row.cover_image_url,
    ownerName: row.owner_name ?? "",
    createdAt: row.created_at ? new Date(row.created_at) : new Date(),
    updatedAt: row.updated_at ? new Date(row.updated_at) : new Date(),
  };
}

export async function isTripAvailableForChildSync(tripId: string) {
  const db = await getDatabase();
  const localId = await resolveLocalTripId(tripId);

  const row = await db.getFirstAsync<{ remote_id: string | null }>(
    "SELECT remote_id FROM trips WHERE id = ?",
    [localId],
  );

  return Boolean(row?.remote_id);
}

export async function resolveRemoteId(localId: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ remote_id: string | null; id: string }>(
    "SELECT id, remote_id FROM trips WHERE id = ? OR remote_id = ?",
    [localId, localId],
  );

  if (!row) {
    return localId;
  }

  return row.remote_id ?? row.id;
}

export async function getStoredRemoteId(entityId: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ remote_id: string | null }>(
    "SELECT remote_id FROM trips WHERE id = ? OR remote_id = ?",
    [entityId, entityId],
  );

  return row?.remote_id ?? null;
}

export async function resolveLocalTripId(tripId: string) {
  const db = await getDatabase();

  const alias = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM sync_metadata WHERE key = ?",
    [`trip_alias:${tripId}`],
  );

  if (alias?.value) {
    return alias.value;
  }

  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM trips WHERE id = ? OR remote_id = ?",
    [tripId, tripId],
  );

  return row?.id ?? tripId;
}

export async function resolveAllTripIds(tripId: string) {
  const localTripId = await resolveLocalTripId(tripId);
  const remoteTripId = await resolveRemoteId(tripId);

  return [...new Set([tripId, localTripId, remoteTripId])];
}

export async function getTravelerTrips() {
  const db = await getDatabase();

  const rows = await db.getAllAsync<TravelerTripRow>(
    "SELECT * FROM traveler_trips ORDER BY starts_at ASC",
  );

  return rows.map(mapTravelerTripRow);
}

export async function getNextTripId() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM sync_metadata WHERE key = 'next_trip_id'",
  );

  return row?.value ?? null;
}

export async function getNextTrip() {
  const nextTripId = await getNextTripId();

  if (!nextTripId) {
    return null;
  }

  const localTripId = await resolveLocalTripId(nextTripId);
  const db = await getDatabase();

  const row = await db.getFirstAsync<TravelerTripRow>(
    "SELECT * FROM traveler_trips WHERE trip_id = ?",
    [localTripId],
  );

  return row ? mapTravelerTripRow(row) : null;
}

export async function getTripById(id: string) {
  const db = await getDatabase();
  const localId = await resolveLocalTripId(id);

  const row = await db.getFirstAsync<TripRow>("SELECT * FROM trips WHERE id = ?", [
    localId,
  ]);

  return row ? mapTripRow(row) : null;
}

export async function getTripSyncStatus(id: string) {
  const db = await getDatabase();
  const localId = await resolveLocalTripId(id);

  const row = await db.getFirstAsync<{ sync_status: EntitySyncStatus }>(
    "SELECT sync_status FROM trips WHERE id = ?",
    [localId],
  );

  return row?.sync_status ?? "synced";
}

async function findLocalTripIdByRemoteOrLocalId(tripId: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ id: string }>(
    "SELECT id FROM trips WHERE id = ? OR remote_id = ?",
    [tripId, tripId],
  );

  return row?.id ?? tripId;
}

export async function mergeTravelerTripsFromServer(trips: TripDetails[]) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM traveler_trips WHERE sync_status = 'synced'");

    for (const trip of trips) {
      const localTripId = await findLocalTripIdByRemoteOrLocalId(trip.tripId);

      await db.runAsync(
        `INSERT INTO trips
         (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at, remote_id, sync_status, last_sync_error)
         VALUES (?, ?, ?, ?, ?, COALESCE((SELECT owner_name FROM trips WHERE id = ?), ''), COALESCE((SELECT created_at FROM trips WHERE id = ?), ?), ?, ?, 'synced', NULL)
         ON CONFLICT(id) DO UPDATE SET
           destination = CASE
             WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.destination
             ELSE excluded.destination
           END,
           starts_at = CASE
             WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.starts_at
             ELSE excluded.starts_at
           END,
           ends_at = CASE
             WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.ends_at
             ELSE excluded.ends_at
           END,
           cover_image_url = excluded.cover_image_url,
           remote_id = excluded.remote_id,
           sync_status = CASE
             WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.sync_status
             ELSE 'synced'
           END,
           updated_at = excluded.updated_at`,
        [
          localTripId,
          trip.destination,
          trip.startsAt,
          trip.endsAt,
          trip.coverImageUrl,
          localTripId,
          localTripId,
          new Date().toISOString(),
          new Date().toISOString(),
          trip.tripId,
        ],
      );

      await db.runAsync(
        `INSERT INTO traveler_trips
         (participant_id, trip_id, destination, starts_at, ends_at, is_confirmed, cover_image_url, remote_id, sync_status, last_sync_error)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL)
         ON CONFLICT(participant_id) DO UPDATE SET
           trip_id = excluded.trip_id,
           destination = CASE
             WHEN traveler_trips.sync_status IN ('pending', 'syncing', 'failed') THEN traveler_trips.destination
             ELSE excluded.destination
           END,
           starts_at = CASE
             WHEN traveler_trips.sync_status IN ('pending', 'syncing', 'failed') THEN traveler_trips.starts_at
             ELSE excluded.starts_at
           END,
           ends_at = CASE
             WHEN traveler_trips.sync_status IN ('pending', 'syncing', 'failed') THEN traveler_trips.ends_at
             ELSE excluded.ends_at
           END,
           is_confirmed = excluded.is_confirmed,
           cover_image_url = excluded.cover_image_url,
           remote_id = excluded.remote_id,
           sync_status = CASE
             WHEN traveler_trips.sync_status IN ('pending', 'syncing', 'failed') THEN traveler_trips.sync_status
             ELSE 'synced'
           END,
           last_sync_error = NULL`,
        [
          trip.participantId,
          localTripId,
          trip.destination,
          trip.startsAt,
          trip.endsAt,
          trip.isConfirmed ? 1 : 0,
          trip.coverImageUrl,
          trip.tripId,
        ],
      );
    }
  });

  await setSyncMetadata("trips_list");
}

/** @deprecated Use mergeTravelerTripsFromServer */
export async function upsertTravelerTrips(trips: TripDetails[]) {
  await mergeTravelerTripsFromServer(trips);
}

export async function resetTripSyncStatus(localId: string, status: EntitySyncStatus) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE trips SET sync_status = ?, last_sync_error = NULL WHERE id = ?`,
      [status, localId],
    );

    await db.runAsync(
      `UPDATE traveler_trips SET sync_status = ?, last_sync_error = NULL WHERE trip_id = ?`,
      [status, localId],
    );
  });
}

export async function setNextTripId(tripId: string | null) {
  if (!tripId) {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM sync_metadata WHERE key = 'next_trip_id'");
    return;
  }

  const localTripId = await resolveLocalTripId(tripId);
  await setSyncMetadata("next_trip_id", localTripId);
}

export async function insertLocalTrip(
  {
    id,
    destination,
    startsAt,
    endsAt,
    ownerName,
    participantId,
    coverImageUrl,
  }: {
    id: string;
    destination: string;
    startsAt: string;
    endsAt: string;
    ownerName: string;
    participantId: string;
    coverImageUrl?: string | null;
  },
  dbOverride?: SQLiteDatabase,
) {
  const now = new Date().toISOString();

  const write = async (db: SQLiteDatabase) => {
    await db.runAsync(
      `INSERT INTO trips
       (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at, remote_id, sync_status, last_sync_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, NULL, 'pending', NULL)`,
      [
        id,
        destination,
        startsAt,
        endsAt,
        coverImageUrl ?? null,
        ownerName,
        now,
        now,
      ],
    );

    await db.runAsync(
      `INSERT INTO traveler_trips
       (participant_id, trip_id, destination, starts_at, ends_at, is_confirmed, cover_image_url, remote_id, sync_status, last_sync_error)
       VALUES (?, ?, ?, ?, ?, 1, ?, NULL, 'pending', NULL)`,
      [
        participantId,
        id,
        destination,
        startsAt,
        endsAt,
        coverImageUrl ?? null,
      ],
    );
  };

  if (dbOverride) {
    await write(dbOverride);
    return;
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => write(db));
}

export async function updateLocalTrip(
  {
    id,
    destination,
    startsAt,
    endsAt,
    syncStatus = "pending",
  }: {
    id: string;
    destination: string;
    startsAt: string;
    endsAt: string;
    syncStatus?: EntitySyncStatus;
  },
  dbOverride?: SQLiteDatabase,
) {
  const now = new Date().toISOString();

  const write = async (db: SQLiteDatabase) => {
    await db.runAsync(
      `UPDATE trips
       SET destination = ?, starts_at = ?, ends_at = ?, updated_at = ?, sync_status = ?, last_sync_error = NULL
       WHERE id = ?`,
      [destination, startsAt, endsAt, now, syncStatus, id],
    );

    await db.runAsync(
      `UPDATE traveler_trips
       SET destination = ?, starts_at = ?, ends_at = ?, sync_status = ?, last_sync_error = NULL
       WHERE trip_id = ?`,
      [destination, startsAt, endsAt, syncStatus, id],
    );
  };

  if (dbOverride) {
    await write(dbOverride);
    return;
  }

  const db = await getDatabase();
  await db.withTransactionAsync(async () => write(db));
}

export async function updateTripRemoteIdAfterSync(
  localId: string,
  remoteId: string,
) {
  if (localId === remoteId) {
    const db = await getDatabase();
    await db.withTransactionAsync(async () => {
      await db.runAsync(
        `UPDATE trips SET remote_id = ?, sync_status = 'synced', last_sync_error = NULL WHERE id = ?`,
        [remoteId, localId],
      );
      await db.runAsync(
        `UPDATE traveler_trips SET remote_id = ?, sync_status = 'synced', last_sync_error = NULL WHERE trip_id = ?`,
        [remoteId, localId],
      );
    });
    return remoteId;
  }

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    const trip = await db.getFirstAsync<TripRow>(
      "SELECT * FROM trips WHERE id = ?",
      [localId],
    );

    if (!trip) {
      return;
    }

    await db.runAsync(
      `INSERT INTO trips
       (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at, remote_id, sync_status, last_sync_error)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL)
       ON CONFLICT(id) DO UPDATE SET
         remote_id = excluded.remote_id,
         sync_status = 'synced',
         last_sync_error = NULL`,
      [
        remoteId,
        trip.destination,
        trip.starts_at,
        trip.ends_at,
        trip.cover_image_url,
        trip.owner_name,
        trip.created_at,
        trip.updated_at,
        remoteId,
      ],
    );

    await db.runAsync(
      "UPDATE activities SET trip_id = ? WHERE trip_id = ?",
      [remoteId, localId],
    );
    await db.runAsync("UPDATE links SET trip_id = ? WHERE trip_id = ?", [
      remoteId,
      localId,
    ]);
    await db.runAsync(
      "UPDATE participants SET trip_id = ? WHERE trip_id = ?",
      [remoteId, localId],
    );
    await db.runAsync(
      "UPDATE traveler_trips SET trip_id = ?, remote_id = ?, sync_status = 'synced', last_sync_error = NULL WHERE trip_id = ?",
      [remoteId, remoteId, localId],
    );
    await db.runAsync(
      "UPDATE sync_queue SET depends_on_entity_id = ? WHERE depends_on_entity_id = ?",
      [remoteId, localId],
    );
    await db.runAsync(
      "UPDATE sync_queue SET entity_id = ? WHERE entity_id = ? AND entity_type = 'trip'",
      [remoteId, localId],
    );

    await db.runAsync(
      `INSERT INTO sync_metadata (key, value, synced_at)
       VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, synced_at = excluded.synced_at`,
      [`trip_alias:${localId}`, remoteId, new Date().toISOString()],
    );

    const nextTrip = await db.getFirstAsync<{ value: string | null }>(
      "SELECT value FROM sync_metadata WHERE key = 'next_trip_id'",
    );

    if (nextTrip?.value === localId) {
      await setSyncMetadata("next_trip_id", remoteId);
    }

    await db.runAsync("DELETE FROM trips WHERE id = ?", [localId]);
  });

  return remoteId;
}

export async function markTripImageSyncFailed(tripId: string, errorMessage: string) {
  const localId = await resolveLocalTripId(tripId);
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE trips SET last_sync_error = ? WHERE id = ?`,
    [`Imagem: ${errorMessage}`, localId],
  );
}

export async function markTripSyncFailed(localId: string, errorMessage: string) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE trips SET sync_status = 'failed', last_sync_error = ? WHERE id = ?`,
      [errorMessage, localId],
    );

    await db.runAsync(
      `UPDATE traveler_trips SET sync_status = 'failed', last_sync_error = ? WHERE trip_id = ?`,
      [errorMessage, localId],
    );
  });
}

export async function markTripSyncing(localId: string) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync(
      `UPDATE trips SET sync_status = 'syncing', last_sync_error = NULL WHERE id = ?`,
      [localId],
    );

    await db.runAsync(
      `UPDATE traveler_trips SET sync_status = 'syncing', last_sync_error = NULL WHERE trip_id = ?`,
      [localId],
    );
  });
}

export async function seedTripDetail({
  id,
  destination,
  startsAt,
  endsAt,
  ownerName,
}: {
  id: string;
  destination: string;
  startsAt: string;
  endsAt: string;
  ownerName: string;
}) {
  const now = new Date();

  await upsertTripDetail({
    id,
    destination,
    startsAt: new Date(startsAt),
    endsAt: new Date(endsAt),
    coverImageUrl: null,
    ownerName,
    createdAt: now,
    updatedAt: now,
  });
}

export async function upsertTripDetail(trip: TripByID) {
  const db = await getDatabase();
  const localId = await resolveLocalTripId(trip.id);

  await db.runAsync(
    `INSERT INTO trips
     (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at, remote_id, sync_status, last_sync_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL)
     ON CONFLICT(id) DO UPDATE SET
       destination = CASE
         WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.destination
         ELSE excluded.destination
       END,
       starts_at = CASE
         WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.starts_at
         ELSE excluded.starts_at
       END,
       ends_at = CASE
         WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.ends_at
         ELSE excluded.ends_at
       END,
       cover_image_url = excluded.cover_image_url,
       owner_name = excluded.owner_name,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       remote_id = COALESCE(trips.remote_id, excluded.remote_id),
       sync_status = CASE
         WHEN trips.sync_status IN ('pending', 'syncing', 'failed') THEN trips.sync_status
         ELSE 'synced'
       END`,
    [
      localId,
      trip.destination,
      trip.startsAt.toISOString(),
      trip.endsAt.toISOString(),
      trip.coverImageUrl ?? null,
      trip.ownerName,
      trip.createdAt.toISOString(),
      trip.updatedAt.toISOString(),
      trip.id,
    ],
  );

  await setSyncMetadata(`trip:${localId}`);
}

export async function overwriteTripFromServer(trip: TripByID) {
  const db = await getDatabase();
  const localId = await resolveLocalTripId(trip.id);

  await db.runAsync(
    `INSERT INTO trips
     (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at, remote_id, sync_status, last_sync_error)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'synced', NULL)
     ON CONFLICT(id) DO UPDATE SET
       destination = excluded.destination,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       cover_image_url = excluded.cover_image_url,
       owner_name = excluded.owner_name,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at,
       remote_id = excluded.remote_id,
       sync_status = 'synced',
       last_sync_error = NULL`,
    [
      localId,
      trip.destination,
      trip.startsAt.toISOString(),
      trip.endsAt.toISOString(),
      trip.coverImageUrl ?? null,
      trip.ownerName,
      trip.createdAt.toISOString(),
      trip.updatedAt.toISOString(),
      trip.id,
    ],
  );

  await db.runAsync(
    `UPDATE traveler_trips
     SET destination = ?, starts_at = ?, ends_at = ?, sync_status = 'synced', last_sync_error = NULL
     WHERE trip_id = ?`,
    [
      trip.destination,
      trip.startsAt.toISOString(),
      trip.endsAt.toISOString(),
      localId,
    ],
  );
}
