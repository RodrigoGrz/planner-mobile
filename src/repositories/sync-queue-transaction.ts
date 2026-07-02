import { getDatabase } from "@/database/database";
import {
  SyncEntityType,
  SyncOperation,
  SyncPayload,
} from "@/types/sync";
import { generateLocalId } from "@/utils/generate-local-id";

export async function enqueueSyncItemInTransaction(
  db: Awaited<ReturnType<typeof getDatabase>>,
  {
    entityType,
    operation,
    entityId,
    payload,
    dependsOnEntityId,
  }: {
    entityType: SyncEntityType;
    operation: SyncOperation;
    entityId: string;
    payload: SyncPayload;
    dependsOnEntityId?: string | null;
  },
) {
  const id = generateLocalId();
  const createdAt = new Date().toISOString();

  await db.runAsync(
    `INSERT INTO sync_queue
     (id, entity_type, operation, entity_id, payload, created_at, retry_count, status, last_error, depends_on_entity_id, next_retry_at)
     VALUES (?, ?, ?, ?, ?, ?, 0, 'pending', NULL, ?, NULL)`,
    [
      id,
      entityType,
      operation,
      entityId,
      JSON.stringify(payload),
      createdAt,
      dependsOnEntityId ?? null,
    ],
  );

  return id;
}
