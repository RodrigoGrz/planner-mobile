import { getDatabase } from "@/database/database";
import { insertLocalActivity } from "@/repositories/activity-repository";
import { insertLocalLink } from "@/repositories/link-repository";
import { enqueueSyncItemInTransaction } from "@/repositories/sync-queue-transaction";
import {
  insertLocalTrip,
  resolveLocalTripId,
  updateLocalTrip,
} from "@/repositories/trip-repository";
import { processSyncQueue } from "@/services/sync-engine";
import { notifyTripDataUpdated } from "@/services/trip-sync-events";
import {
  ActivityCreatePayload,
  LinkCreatePayload,
  TripCreatePayload,
  TripUpdatePayload,
} from "@/types/sync";
import { generateLocalId } from "@/utils/generate-local-id";
import { toApiDate } from "@/utils/to-api-date";

type OnlineChecker = () => boolean;

let isOnlineChecker: OnlineChecker = () => true;

export function setMutationOnlineChecker(checker: OnlineChecker) {
  isOnlineChecker = checker;
}

async function runSyncIfOnline() {
  if (isOnlineChecker()) {
    await processSyncQueue();
  }
}

export async function createTrip({
  destination,
  startsAt,
  endsAt,
  emailsToInvite,
  ownerName,
  coverImageUri,
}: Omit<TripCreatePayload, "coverImageUri"> & {
  coverImageUri?: string | null;
}) {
  const localId = generateLocalId();
  const participantId = generateLocalId();
  const normalizedStartsAt = toApiDate(startsAt);
  const normalizedEndsAt = toApiDate(endsAt);

  const payload: TripCreatePayload = {
    destination,
    startsAt: normalizedStartsAt,
    endsAt: normalizedEndsAt,
    emailsToInvite,
    ownerName,
    coverImageUri: coverImageUri ?? null,
  };

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await insertLocalTrip(
      {
        id: localId,
        destination,
        startsAt: normalizedStartsAt,
        endsAt: normalizedEndsAt,
        ownerName,
        participantId,
        coverImageUrl: coverImageUri ?? null,
      },
      db,
    );

    await enqueueSyncItemInTransaction(db, {
      entityType: "trip",
      operation: "create",
      entityId: localId,
      payload,
    });

    if (coverImageUri) {
      await enqueueSyncItemInTransaction(db, {
        entityType: "trip_image",
        operation: "create",
        entityId: `${localId}-image`,
        payload: {
          tripId: localId,
          coverImageUri,
        },
        dependsOnEntityId: localId,
      });
    }
  });

  notifyTripDataUpdated(localId);
  await runSyncIfOnline();

  return { localId };
}

export async function updateTrip({
  tripId,
  destination,
  startsAt,
  endsAt,
}: TripUpdatePayload & { tripId: string }) {
  const localTripId = await resolveLocalTripId(tripId);
  const normalizedStartsAt = toApiDate(startsAt);
  const normalizedEndsAt = toApiDate(endsAt);

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await updateLocalTrip(
      {
        id: localTripId,
        destination,
        startsAt: normalizedStartsAt,
        endsAt: normalizedEndsAt,
        syncStatus: "pending",
      },
      db,
    );

    await enqueueSyncItemInTransaction(db, {
      entityType: "trip",
      operation: "update",
      entityId: localTripId,
      payload: {
        destination,
        startsAt: normalizedStartsAt,
        endsAt: normalizedEndsAt,
      },
    });
  });

  notifyTripDataUpdated(localTripId);
  await runSyncIfOnline();
}

export async function createActivity({
  tripId,
  title,
  occursAt,
}: ActivityCreatePayload) {
  const localId = generateLocalId();
  const localTripId = await resolveLocalTripId(tripId);
  const normalizedOccursAt = toApiDate(occursAt);

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await insertLocalActivity(
      {
        id: localId,
        tripId: localTripId,
        title,
        occursAt: normalizedOccursAt,
      },
      db,
    );

    await enqueueSyncItemInTransaction(db, {
      entityType: "activity",
      operation: "create",
      entityId: localId,
      payload: {
        tripId: localTripId,
        title,
        occursAt: normalizedOccursAt,
      },
      dependsOnEntityId: localTripId,
    });
  });

  notifyTripDataUpdated(localTripId);
  await runSyncIfOnline();

  return { localId };
}

export async function createLink({
  tripId,
  title,
  url,
}: LinkCreatePayload) {
  const localId = generateLocalId();
  const localTripId = await resolveLocalTripId(tripId);

  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await insertLocalLink(
      {
        id: localId,
        tripId: localTripId,
        title,
        url,
      },
      db,
    );

    await enqueueSyncItemInTransaction(db, {
      entityType: "link",
      operation: "create",
      entityId: localId,
      payload: {
        tripId: localTripId,
        title,
        url,
      },
      dependsOnEntityId: localTripId,
    });
  });

  notifyTripDataUpdated(localTripId);
  await runSyncIfOnline();

  return { localId };
}

export const mutationService = {
  createTrip,
  updateTrip,
  createActivity,
  createLink,
};
