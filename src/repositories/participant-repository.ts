import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { resolveLocalTripId } from "@/repositories/trip-repository";
import { Participant } from "@/server/participants-server";

type ParticipantRow = {
  id: string;
  trip_id: string;
  name: string | null;
  email: string;
  is_confirmed: number;
};

function mapParticipantRow(row: ParticipantRow): Participant {
  return {
    id: row.id,
    name: row.name ?? "",
    email: row.email,
    isConfirmed: row.is_confirmed === 1,
  };
}

export async function getParticipantsByTripId(tripId: string) {
  const db = await getDatabase();
  const localTripId = await resolveLocalTripId(tripId);

  const rows = await db.getAllAsync<ParticipantRow>(
    "SELECT * FROM participants WHERE trip_id = ? ORDER BY name ASC",
    [localTripId],
  );

  return rows.map(mapParticipantRow);
}

export async function replaceParticipantsByTripId(
  tripId: string,
  participants: Participant[],
) {
  const db = await getDatabase();
  const localTripId = await resolveLocalTripId(tripId);

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM participants WHERE trip_id = ?", [localTripId]);

    for (const participant of participants) {
      await db.runAsync(
        `INSERT INTO participants (id, trip_id, name, email, is_confirmed)
         VALUES (?, ?, ?, ?, ?)`,
        [
          participant.id,
          localTripId,
          participant.name,
          participant.email,
          participant.isConfirmed ? 1 : 0,
        ],
      );
    }
  });

  await setSyncMetadata(`participants:${localTripId}`);
}
