import { getDatabase } from "./database";
import { runMigrations } from "./migrations";

let initialized = false;

export async function initDatabase() {
  if (initialized) {
    return;
  }

  const db = await getDatabase();
  await runMigrations(db);
  initialized = true;
}
