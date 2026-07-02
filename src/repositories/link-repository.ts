import { SQLiteDatabase } from "expo-sqlite";
import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { EntitySyncStatus } from "@/types/sync";
import { resolveAllTripIds, resolveLocalTripId } from "@/repositories/trip-repository";
import { Link } from "@/server/links-server";

type LinkRow = {
  id: string;
  trip_id: string;
  title: string;
  url: string;
  remote_id: string | null;
  sync_status: EntitySyncStatus;
  last_sync_error: string | null;
};

export type LinkWithSyncStatus = Link & {
  syncStatus?: EntitySyncStatus;
};

function mapLinkRow(row: LinkRow): LinkWithSyncStatus {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
    syncStatus: row.sync_status,
  };
}

function linksMatchSameEntity(a: LinkRow, b: LinkRow) {
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

  return a.title === b.title && a.url === b.url;
}

function pickPreferredLinkRow(current: LinkRow, candidate: LinkRow) {
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

function dedupeLinkRows(rows: LinkRow[]) {
  const deduped: LinkRow[] = [];

  for (const row of rows) {
    const matchIndex = deduped.findIndex((existing) =>
      linksMatchSameEntity(existing, row),
    );

    if (matchIndex === -1) {
      deduped.push(row);
      continue;
    }

    deduped[matchIndex] = pickPreferredLinkRow(deduped[matchIndex], row);
  }

  return deduped;
}

export async function getLinksByTripId(tripId: string) {
  const db = await getDatabase();
  const relatedTripIds = await resolveAllTripIds(tripId);
  const placeholders = relatedTripIds.map(() => "?").join(", ");

  const rows = await db.getAllAsync<LinkRow>(
    `SELECT * FROM links WHERE trip_id IN (${placeholders}) ORDER BY title ASC`,
    relatedTripIds,
  );

  return dedupeLinkRows(rows).map(mapLinkRow);
}

export async function insertLocalLink(
  {
    id,
    tripId,
    title,
    url,
  }: {
    id: string;
    tripId: string;
    title: string;
    url: string;
  },
  dbOverride?: SQLiteDatabase,
) {
  const localTripId = await resolveLocalTripId(tripId);
  const db = dbOverride ?? (await getDatabase());

  await db.runAsync(
    `INSERT INTO links
     (id, trip_id, title, url, remote_id, sync_status, last_sync_error)
     VALUES (?, ?, ?, ?, NULL, 'pending', NULL)`,
    [id, localTripId, title, url],
  );
}

export async function getStoredLinkRemoteId(entityId: string) {
  const db = await getDatabase();

  const row = await db.getFirstAsync<{ remote_id: string | null }>(
    "SELECT remote_id FROM links WHERE id = ? OR remote_id = ?",
    [entityId, entityId],
  );

  return row?.remote_id ?? null;
}

export async function resetLinkSyncStatus(localId: string, status: EntitySyncStatus) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE links SET sync_status = ?, last_sync_error = NULL WHERE id = ?`,
    [status, localId],
  );
}

export async function updateLinkRemoteIdAfterSync(
  localId: string,
  remoteId: string,
) {
  const db = await getDatabase();

  if (localId === remoteId) {
    await db.runAsync(
      `UPDATE links
       SET remote_id = ?, sync_status = 'synced', last_sync_error = NULL
       WHERE id = ?`,
      [remoteId, localId],
    );
    return;
  }

  await db.withTransactionAsync(async () => {
    const link = await db.getFirstAsync<LinkRow>(
      "SELECT * FROM links WHERE id = ?",
      [localId],
    );

    if (!link) {
      return;
    }

    await db.runAsync(
      `INSERT INTO links
       (id, trip_id, title, url, remote_id, sync_status, last_sync_error)
       VALUES (?, ?, ?, ?, ?, 'synced', NULL)
       ON CONFLICT(id) DO UPDATE SET
         title = excluded.title,
         url = excluded.url,
         remote_id = excluded.remote_id,
         sync_status = 'synced',
         last_sync_error = NULL`,
      [remoteId, link.trip_id, link.title, link.url, remoteId],
    );

    await db.runAsync(
      "UPDATE sync_queue SET entity_id = ? WHERE entity_id = ? AND entity_type = 'link'",
      [remoteId, localId],
    );
    await db.runAsync("DELETE FROM links WHERE id = ?", [localId]);
  });
}

export async function markLinkSyncFailed(localId: string, errorMessage: string) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE links SET sync_status = 'failed', last_sync_error = ? WHERE id = ?`,
    [errorMessage, localId],
  );
}

export async function markLinkSyncing(localId: string) {
  const db = await getDatabase();

  await db.runAsync(
    `UPDATE links SET sync_status = 'syncing', last_sync_error = NULL WHERE id = ?`,
    [localId],
  );
}

export async function mergeLinksFromServer(tripId: string, links: Link[]) {
  const db = await getDatabase();
  const localTripId = await resolveLocalTripId(tripId);
  const relatedTripIds = await resolveAllTripIds(tripId);

  await db.withTransactionAsync(async () => {
    for (const relatedTripId of relatedTripIds) {
      if (relatedTripId !== localTripId) {
        await db.runAsync("UPDATE links SET trip_id = ? WHERE trip_id = ?", [
          localTripId,
          relatedTripId,
        ]);
      }
    }

    await db.runAsync(
      "DELETE FROM links WHERE trip_id = ? AND sync_status = 'synced'",
      [localTripId],
    );

    for (const link of links) {
      await db.runAsync(
        `DELETE FROM links
         WHERE trip_id = ?
         AND id != ?
         AND (remote_id = ? OR id = ?)`,
        [localTripId, link.id, link.id, link.id],
      );

      await db.runAsync(
        `INSERT INTO links
         (id, trip_id, title, url, remote_id, sync_status, last_sync_error)
         VALUES (?, ?, ?, ?, ?, 'synced', NULL)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           url = excluded.url,
           remote_id = excluded.remote_id,
           trip_id = excluded.trip_id,
           sync_status = CASE
             WHEN links.sync_status IN ('pending', 'syncing', 'failed') THEN links.sync_status
             ELSE 'synced'
           END`,
        [link.id, localTripId, link.title, link.url, link.id],
      );
    }
  });

  for (const relatedTripId of relatedTripIds) {
    await setSyncMetadata(`links:${relatedTripId}`);
  }
}

/** @deprecated Use mergeLinksFromServer */
export async function replaceLinksByTripId(tripId: string, links: Link[]) {
  await mergeLinksFromServer(tripId, links);
}
