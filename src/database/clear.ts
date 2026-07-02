import { getDatabase } from "./database";

export async function clearDatabase() {
  try {
    const db = await getDatabase();

    await db.withTransactionAsync(async () => {
      await db.runAsync("DELETE FROM participants");
      await db.runAsync("DELETE FROM links");
      await db.runAsync("DELETE FROM activities");
      await db.runAsync("DELETE FROM traveler_trips");
      await db.runAsync("DELETE FROM trips");
      await db.runAsync("DELETE FROM sync_queue");
      await db.runAsync("DELETE FROM sync_metadata");
    });
  } catch (error) {
    console.warn("Failed to clear local database:", error);
  }
}
