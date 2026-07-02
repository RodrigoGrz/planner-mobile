import { getDatabase } from "./database";
import { runMigrations } from "./migrations";
import { resetStaleSyncingItems } from "@/repositories/sync-queue-repository";

let initialized = false;

export async function initDatabase() {
  if (initialized) {
    return;
  }

  const db = await getDatabase();
  await runMigrations(db);
  await resetStaleSyncingItems();
  initialized = true;
}
