import { getDatabase } from "@/database/database";
import {
  SyncEntityType,
  SyncOperation,
  SyncPayload,
  SyncQueueItem,
  SyncQueueStatus,
} from "@/types/sync";
import { generateLocalId } from "@/utils/generate-local-id";

type SyncQueueRow = {
  id: string;
  entity_type: SyncEntityType;
  operation: SyncOperation;
  entity_id: string;
  payload: string;
  created_at: string;
  retry_count: number;
  status: SyncQueueStatus;
  last_error: string | null;
  depends_on_entity_id: string | null;
  next_retry_at: string | null;
};

function mapRow(row: SyncQueueRow): SyncQueueItem {
  return {
    id: row.id,
    entityType: row.entity_type,
    operation: row.operation,
    entityId: row.entity_id,
    payload: JSON.parse(row.payload) as SyncPayload,
    createdAt: row.created_at,
    retryCount: row.retry_count,
    status: row.status,
    lastError: row.last_error,
    dependsOnEntityId: row.depends_on_entity_id,
    nextRetryAt: row.next_retry_at,
  };
}

export async function enqueueSyncItem({
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
}) {
  const db = await getDatabase();
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

export async function resetStaleSyncingItems() {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', last_error = NULL
     WHERE status = 'syncing'`,
  );
}

export async function getQueueItemsOrdered() {
  const db = await getDatabase();
  const now = new Date().toISOString();

  const rows = await db.getAllAsync<SyncQueueRow>(
    `SELECT * FROM sync_queue
     WHERE status IN ('pending', 'failed')
       AND (next_retry_at IS NULL OR next_retry_at <= ?)
     ORDER BY created_at ASC`,
    [now],
  );

  return rows.map(mapRow);
}

export async function markQueueItemSyncing(id: string) {
  const db = await getDatabase();

  await db.runAsync(
    "UPDATE sync_queue SET status = 'syncing', last_error = NULL WHERE id = ?",
    [id],
  );
}

export async function markQueueItemFailed(
  id: string,
  errorMessage: string,
  retryCount: number,
  nextRetryAt: string | null = null,
) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET status = ?, last_error = ?, retry_count = ?, next_retry_at = ?
     WHERE id = ?`,
    [
      nextRetryAt ? "pending" : "failed",
      errorMessage,
      retryCount,
      nextRetryAt,
      id,
    ],
  );
}

export async function resetFailedQueueItems() {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE sync_queue
     SET status = 'pending', last_error = NULL, retry_count = 0, next_retry_at = NULL
     WHERE status = 'failed'`,
  );
}

export async function removeQueueItems(ids: string[]) {
  if (ids.length === 0) {
    return;
  }

  const db = await getDatabase();
  const placeholders = ids.map(() => "?").join(", ");

  await db.runAsync(`DELETE FROM sync_queue WHERE id IN (${placeholders})`, ids);
}

export async function countPendingQueueItems() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'pending'",
  );

  return row?.count ?? 0;
}

export async function countFailedQueueItems() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'failed'",
  );

  return row?.count ?? 0;
}

export async function countSyncingQueueItems() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status = 'syncing'",
  );

  return row?.count ?? 0;
}

export async function countActiveQueueItems() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue WHERE status IN ('pending', 'failed', 'syncing')",
  );

  return row?.count ?? 0;
}

export async function countAllQueueItems() {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ count: number }>(
    "SELECT COUNT(*) as count FROM sync_queue",
  );

  return row?.count ?? 0;
}
