export type SyncEntityType = "trip" | "activity" | "link" | "trip_image";

export type SyncOperation = "create" | "update";

export type SyncQueueStatus = "pending" | "syncing" | "synced" | "failed";

export type EntitySyncStatus = "synced" | "pending" | "syncing" | "failed";

export type TripCreatePayload = {
  destination: string;
  startsAt: string;
  endsAt: string;
  emailsToInvite: string[];
  ownerName: string;
  coverImageUri?: string | null;
};

export type TripUpdatePayload = {
  destination: string;
  startsAt: string;
  endsAt: string;
};

export type ActivityCreatePayload = {
  tripId: string;
  title: string;
  occursAt: string;
};

export type LinkCreatePayload = {
  tripId: string;
  title: string;
  url: string;
};

export type TripImagePayload = {
  tripId: string;
  coverImageUri: string;
};

export type SyncPayload =
  | TripCreatePayload
  | TripUpdatePayload
  | ActivityCreatePayload
  | LinkCreatePayload
  | TripImagePayload;

export type SyncQueueItem = {
  id: string;
  entityType: SyncEntityType;
  operation: SyncOperation;
  entityId: string;
  payload: SyncPayload;
  createdAt: string;
  retryCount: number;
  status: SyncQueueStatus;
  lastError: string | null;
  dependsOnEntityId: string | null;
  nextRetryAt: string | null;
};

export type CoalescedQueueItem = Omit<
  SyncQueueItem,
  "id" | "createdAt" | "retryCount" | "status" | "lastError" | "nextRetryAt"
> & {
  sourceQueueIds: string[];
};
