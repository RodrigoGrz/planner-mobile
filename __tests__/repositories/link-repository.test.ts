import { markLinkSyncedWithoutRemoteId } from "@/repositories/link-repository";

const mockRunAsync = jest.fn();

jest.mock("@/database/database", () => ({
  getDatabase: jest.fn(() =>
    Promise.resolve({
      runAsync: mockRunAsync,
    }),
  ),
}));

jest.mock("@/database/sync-metadata", () => ({
  setSyncMetadata: jest.fn(),
}));

jest.mock("@/repositories/trip-repository", () => ({
  resolveLocalTripId: jest.fn(),
  resolveAllTripIds: jest.fn(),
}));

describe("link-repository", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should mark a link as synced keeping its local id", async () => {
    await markLinkSyncedWithoutRemoteId("link-local-1");

    expect(mockRunAsync).toHaveBeenCalledTimes(1);

    const [sql, params] = mockRunAsync.mock.calls[0];

    expect(sql).toMatch(/UPDATE links/);
    expect(sql).toMatch(/sync_status = 'synced'/);
    expect(sql).toMatch(/last_sync_error = NULL/);
    expect(sql).not.toMatch(/remote_id/);
    expect(params).toEqual(["link-local-1"]);
  });
});
