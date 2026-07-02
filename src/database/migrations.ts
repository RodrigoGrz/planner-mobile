import { SQLiteDatabase } from "expo-sqlite";

const SCHEMA_VERSION_KEY = "schema_version";
const CURRENT_SCHEMA_VERSION = 3;

const TABLES_SQL = `
CREATE TABLE IF NOT EXISTS trips (
  id TEXT PRIMARY KEY,
  destination TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  cover_image_url TEXT,
  owner_name TEXT,
  created_at TEXT,
  updated_at TEXT,
  remote_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS traveler_trips (
  participant_id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  destination TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  is_confirmed INTEGER NOT NULL DEFAULT 0,
  cover_image_url TEXT,
  remote_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS activities (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  occurs_at TEXT NOT NULL,
  remote_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS links (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  url TEXT NOT NULL,
  remote_id TEXT,
  sync_status TEXT NOT NULL DEFAULT 'synced',
  last_sync_error TEXT
);

CREATE TABLE IF NOT EXISTS participants (
  id TEXT PRIMARY KEY,
  trip_id TEXT NOT NULL REFERENCES trips(id) ON DELETE CASCADE,
  name TEXT,
  email TEXT NOT NULL,
  is_confirmed INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS sync_metadata (
  key TEXT PRIMARY KEY,
  value TEXT,
  synced_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS sync_queue (
  id TEXT PRIMARY KEY,
  entity_type TEXT NOT NULL,
  operation TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  payload TEXT NOT NULL,
  created_at TEXT NOT NULL,
  retry_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  last_error TEXT,
  depends_on_entity_id TEXT,
  next_retry_at TEXT
);
`;

async function getSchemaVersion(db: SQLiteDatabase) {
  const row = await db.getFirstAsync<{ value: string | null }>(
    "SELECT value FROM sync_metadata WHERE key = ?",
    [SCHEMA_VERSION_KEY],
  );

  return row?.value ? Number(row.value) : 1;
}

async function setSchemaVersion(db: SQLiteDatabase, version: number) {
  await db.runAsync(
    `INSERT INTO sync_metadata (key, value, synced_at)
     VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, synced_at = excluded.synced_at`,
    [SCHEMA_VERSION_KEY, String(version), new Date().toISOString()],
  );
}

async function columnExists(db: SQLiteDatabase, table: string, column: string) {
  const columns = await db.getAllAsync<{ name: string }>(
    `PRAGMA table_info(${table})`,
  );

  return columns.some((entry) => entry.name === column);
}

async function addColumnIfMissing(
  db: SQLiteDatabase,
  table: string,
  definition: string,
) {
  const columnName = definition.split(" ")[0];

  if (!(await columnExists(db, table, columnName))) {
    await db.execAsync(`ALTER TABLE ${table} ADD COLUMN ${definition};`);
  }
}

async function migrateToV2(db: SQLiteDatabase) {
  await addColumnIfMissing(db, "trips", "remote_id TEXT");
  await addColumnIfMissing(
    db,
    "trips",
    "sync_status TEXT NOT NULL DEFAULT 'synced'",
  );
  await addColumnIfMissing(db, "trips", "last_sync_error TEXT");

  await addColumnIfMissing(db, "traveler_trips", "remote_id TEXT");
  await addColumnIfMissing(
    db,
    "traveler_trips",
    "sync_status TEXT NOT NULL DEFAULT 'synced'",
  );
  await addColumnIfMissing(db, "traveler_trips", "last_sync_error TEXT");

  await addColumnIfMissing(db, "activities", "remote_id TEXT");
  await addColumnIfMissing(
    db,
    "activities",
    "sync_status TEXT NOT NULL DEFAULT 'synced'",
  );
  await addColumnIfMissing(db, "activities", "last_sync_error TEXT");

  await addColumnIfMissing(db, "links", "remote_id TEXT");
  await addColumnIfMissing(
    db,
    "links",
    "sync_status TEXT NOT NULL DEFAULT 'synced'",
  );
  await addColumnIfMissing(db, "links", "last_sync_error TEXT");

  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS sync_queue (
      id TEXT PRIMARY KEY,
      entity_type TEXT NOT NULL,
      operation TEXT NOT NULL,
      entity_id TEXT NOT NULL,
      payload TEXT NOT NULL,
      created_at TEXT NOT NULL,
      retry_count INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'pending',
      last_error TEXT,
      depends_on_entity_id TEXT
    );
  `);

  await db.execAsync(`
    UPDATE trips SET sync_status = 'synced', remote_id = id WHERE sync_status IS NULL OR remote_id IS NULL;
    UPDATE traveler_trips SET sync_status = 'synced' WHERE sync_status IS NULL;
    UPDATE activities SET sync_status = 'synced', remote_id = id WHERE sync_status IS NULL OR remote_id IS NULL;
    UPDATE links SET sync_status = 'synced', remote_id = id WHERE sync_status IS NULL OR remote_id IS NULL;
  `);
}

async function migrateToV3(db: SQLiteDatabase) {
  await addColumnIfMissing(db, "sync_queue", "next_retry_at TEXT");
}

export async function runMigrations(db: SQLiteDatabase) {
  await db.execAsync("PRAGMA journal_mode = WAL;");
  await db.execAsync("PRAGMA foreign_keys = ON;");
  await db.execAsync(TABLES_SQL);

  const currentVersion = await getSchemaVersion(db);

  if (currentVersion < 2) {
    await migrateToV2(db);
    await setSchemaVersion(db, 2);
  }

  if (currentVersion < 3) {
    await migrateToV3(db);
    await setSchemaVersion(db, CURRENT_SCHEMA_VERSION);
  }
}
