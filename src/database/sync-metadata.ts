import { getDatabase } from "./database";

export async function setSyncMetadata(key: string, value?: string | null) {
  const db = await getDatabase();

  await db.runAsync(
    `INSERT INTO sync_metadata (key, value, synced_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET
       value = excluded.value,
       synced_at = excluded.synced_at`,
    [key, value ?? null, new Date().toISOString()],
  );
}

export async function getSyncMetadata(key: string) {
  const db = await getDatabase();

  return db.getFirstAsync<{ value: string | null; synced_at: string }>(
    "SELECT value, synced_at FROM sync_metadata WHERE key = ?",
    [key],
  );
}
