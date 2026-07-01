import { getDatabase } from "./database";

export async function clearDatabase() {
  try {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await db.execAsync(`
        DELETE FROM participants;
        DELETE FROM links;
        DELETE FROM activities;
        DELETE FROM traveler_trips;
        DELETE FROM trips;
        DELETE FROM sync_metadata;
      `);
    });
  } catch (error) {
    console.warn("Failed to clear local database:", error);
  }
}
