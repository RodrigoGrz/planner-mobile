import { runMigrations } from "@/database/migrations";
import { SQLiteDatabase } from "expo-sqlite";

function makeDatabase(schemaVersion: string | null) {
  return {
    execAsync: jest.fn(),
    runAsync: jest.fn(),
    getAllAsync: jest.fn(() => Promise.resolve([])),
    getFirstAsync: jest.fn(() =>
      Promise.resolve(schemaVersion ? { value: schemaVersion } : null),
    ),
  };
}

function executedSql(db: ReturnType<typeof makeDatabase>) {
  return [...db.execAsync.mock.calls, ...db.runAsync.mock.calls]
    .map(([sql]) => String(sql))
    .join("\n");
}

function savedSchemaVersions(db: ReturnType<typeof makeDatabase>) {
  return db.runAsync.mock.calls
    .filter(([, params]) => Array.isArray(params) && params[0] === "schema_version")
    .map(([, params]) => params[1]);
}

describe("runMigrations", () => {
  it("should delete rows with null ids when migrating to v4", async () => {
    const db = makeDatabase("3");

    await runMigrations(db as unknown as SQLiteDatabase);

    const sql = executedSql(db);

    expect(sql).toMatch(/DELETE FROM activities WHERE id IS NULL/);
    expect(sql).toMatch(/DELETE FROM links WHERE id IS NULL/);
    expect(sql).toMatch(/DELETE FROM sync_queue WHERE entity_id IS NULL/);
    expect(savedSchemaVersions(db)).toEqual(["4"]);
  });

  it("should not run v4 again when the schema is already at v4", async () => {
    const db = makeDatabase("4");

    await runMigrations(db as unknown as SQLiteDatabase);

    expect(executedSql(db)).not.toMatch(/WHERE id IS NULL/);
    expect(savedSchemaVersions(db)).toEqual([]);
  });

  it("should run v3 and v4 in order when the schema is at v2", async () => {
    const db = makeDatabase("2");

    await runMigrations(db as unknown as SQLiteDatabase);

    expect(executedSql(db)).toMatch(/DELETE FROM activities WHERE id IS NULL/);
    expect(savedSchemaVersions(db)).toEqual(["3", "4"]);
  });
});
