import * as SQLite from "expo-sqlite";

let database: SQLite.SQLiteDatabase | null = null;

export async function getDatabase() {
  if (!database) {
    database = await SQLite.openDatabaseAsync("planner.db");
  }

  return database;
}

export async function closeDatabase() {
  if (database) {
    await database.closeAsync();
    database = null;
  }
}
