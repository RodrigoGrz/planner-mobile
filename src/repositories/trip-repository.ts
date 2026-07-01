import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { TripByID, TripDetails } from "@/server/trip-server";

type TravelerTripRow = {
  participant_id: string;
  trip_id: string;
  destination: string;
  starts_at: string;
  ends_at: string;
  is_confirmed: number;
  cover_image_url: string | null;
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

  const db = await getDatabase();

  const row = await db.getFirstAsync<TravelerTripRow>(
    "SELECT * FROM traveler_trips WHERE trip_id = ?",
    [nextTripId],
  );

  return row ? mapTravelerTripRow(row) : null;
}

export async function getTripById(id: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<TripRow>("SELECT * FROM trips WHERE id = ?", [
    id,
  ]);

  return row ? mapTripRow(row) : null;
}

export async function upsertTravelerTrips(trips: TripDetails[]) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM traveler_trips");

    for (const trip of trips) {
      await db.runAsync(
        `INSERT INTO trips (id, destination, starts_at, ends_at, cover_image_url)
         VALUES (?, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           destination = excluded.destination,
           starts_at = excluded.starts_at,
           ends_at = excluded.ends_at,
           cover_image_url = excluded.cover_image_url`,
        [
          trip.tripId,
          trip.destination,
          trip.startsAt,
          trip.endsAt,
          trip.coverImageUrl,
        ],
      );

      await db.runAsync(
        `INSERT INTO traveler_trips
         (participant_id, trip_id, destination, starts_at, ends_at, is_confirmed, cover_image_url)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
        [
          trip.participantId,
          trip.tripId,
          trip.destination,
          trip.startsAt,
          trip.endsAt,
          trip.isConfirmed ? 1 : 0,
          trip.coverImageUrl,
        ],
      );
    }
  });

  await setSyncMetadata("trips_list");
}

export async function setNextTripId(tripId: string | null) {
  if (!tripId) {
    const db = await getDatabase();
    await db.runAsync("DELETE FROM sync_metadata WHERE key = 'next_trip_id'");
    return;
  }

  await setSyncMetadata("next_trip_id", tripId);
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

  await db.runAsync(
    `INSERT INTO trips
     (id, destination, starts_at, ends_at, cover_image_url, owner_name, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET
       destination = excluded.destination,
       starts_at = excluded.starts_at,
       ends_at = excluded.ends_at,
       cover_image_url = excluded.cover_image_url,
       owner_name = excluded.owner_name,
       created_at = excluded.created_at,
       updated_at = excluded.updated_at`,
    [
      trip.id,
      trip.destination,
      trip.startsAt.toISOString(),
      trip.endsAt.toISOString(),
      trip.coverImageUrl ?? null,
      trip.ownerName,
      trip.createdAt.toISOString(),
      trip.updatedAt.toISOString(),
    ],
  );

  await setSyncMetadata(`trip:${trip.id}`);
}
