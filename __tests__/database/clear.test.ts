import { clearDatabase } from "@/database/clear";

const mockRunAsync = jest.fn();
const mockWithTransactionAsync = jest.fn(async (callback: () => Promise<void>) => {
  await callback();
});

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
      withTransactionAsync: mockWithTransactionAsync,
    }),
  ),
}));

describe("clearDatabase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should delete every local table inside a transaction", async () => {
    await clearDatabase();

    expect(mockWithTransactionAsync).toHaveBeenCalledTimes(1);
    for (const table of [
      "participants",
      "links",
      "activities",
      "traveler_trips",
      "trips",
      "sync_queue",
      "sync_metadata",
    ]) {
      expect(mockRunAsync).toHaveBeenCalledWith(`DELETE FROM ${table}`);
    }
  });

  it("should rethrow when the local data cannot be cleared", async () => {
    mockRunAsync.mockRejectedValueOnce(new Error("SQLITE_BUSY"));

    await expect(clearDatabase()).rejects.toThrow("SQLITE_BUSY");
  });
});
