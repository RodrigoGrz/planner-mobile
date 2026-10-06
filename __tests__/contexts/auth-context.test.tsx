import { act, renderHook, waitFor } from "@testing-library/react-native";

import { AuthContextProvider } from "@/contexts/AuthContext";
import { clearDatabase } from "@/database/clear";
import { useAuth } from "@/hooks/useAuth";
import { api } from "@/server/api";
import {
  storageAuthTokenGet,
  storageAuthTokenRemove,
  storageAuthTokenSave,
} from "@/storage/auth-token";
import {
  storageLastUserIdGet,
  storageLastUserIdRemove,
  storageLastUserIdSave,
  storageUserGet,
  storageUserRemove,
  storageUserSave,
} from "@/storage/user";

let mockUnauthorizedHandler: () => Promise<void> = async () => {};

jest.mock("@/server/api", () => ({
  api: {
    post: jest.fn(),
    defaults: { headers: { common: {} as Record<string, string> } },
    registerInterceptTokenManager: jest.fn((handler: () => Promise<void>) => {
      mockUnauthorizedHandler = handler;
      return jest.fn();
    }),
  },
}));

jest.mock("@/storage/auth-token", () => ({
  storageAuthTokenGet: jest.fn(),
  storageAuthTokenRemove: jest.fn(),
  storageAuthTokenSave: jest.fn(),
}));

jest.mock("@/storage/user", () => ({
  storageLastUserIdGet: jest.fn(),
  storageLastUserIdRemove: jest.fn(),
  storageLastUserIdSave: jest.fn(),
  storageUserGet: jest.fn(),
  storageUserRemove: jest.fn(),
  storageUserSave: jest.fn(),
}));

jest.mock("@/database/clear", () => ({
  clearDatabase: jest.fn(),
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

const ana = {
  id: "user-1",
  name: "Ana",
  email: "ana@example.com",
  phone: "11999999999",
};

const bruno = {
  id: "user-2",
  name: "Bruno",
  email: "bruno@example.com",
  phone: "11888888888",
};

function mockStoredSession({
  user = null as typeof ana | null,
  token = undefined as string | undefined,
  lastUserId = null as string | null,
} = {}) {
  (storageUserGet as jest.Mock).mockResolvedValue(user);
  (storageAuthTokenGet as jest.Mock).mockResolvedValue({ token });
  (storageLastUserIdGet as jest.Mock).mockResolvedValue(lastUserId);
}

async function renderAuth() {
  const hook = renderHook(() => useAuth(), { wrapper: AuthContextProvider });

  await waitFor(() => {
    expect(hook.result.current.isLoadingUserStorageData).toBe(false);
  });

  return hook;
}

async function renderLoggedInAuth() {
  mockStoredSession({ user: ana, token: "token-1", lastUserId: ana.id });
  const hook = await renderAuth();

  await waitFor(() => {
    expect(hook.result.current.user).toEqual(ana);
  });

  return hook;
}

function mockSignInResponse(user: typeof ana) {
  (api.post as jest.Mock).mockResolvedValue({
    data: { user, token: `token-${user.id}` },
  });
}

describe("AuthContextProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    api.defaults.headers.common = {};
    mockStoredSession();
  });

  describe("session expiry", () => {
    it("should keep the local database when the session expires", async () => {
      const { result } = await renderLoggedInAuth();

      await act(async () => {
        await mockUnauthorizedHandler();
      });

      expect(result.current.user).toBeNull();
      expect(clearDatabase).not.toHaveBeenCalled();
    });

    it("should remove the token and the user when the session expires", async () => {
      await renderLoggedInAuth();

      await act(async () => {
        await mockUnauthorizedHandler();
      });

      expect(storageAuthTokenRemove).toHaveBeenCalledTimes(1);
      expect(storageUserRemove).toHaveBeenCalledTimes(1);
      expect(storageLastUserIdRemove).not.toHaveBeenCalled();
      expect(api.defaults.headers.common.Authorization).toBeUndefined();
    });

    it("should flag the session as expired", async () => {
      const { result } = await renderLoggedInAuth();
      expect(result.current.sessionExpired).toBe(false);

      await act(async () => {
        await mockUnauthorizedHandler();
      });

      expect(result.current.sessionExpired).toBe(true);
    });

    it("should expire the session only once for concurrent unauthorized responses", async () => {
      await renderLoggedInAuth();

      await act(async () => {
        await Promise.all([mockUnauthorizedHandler(), mockUnauthorizedHandler()]);
      });

      expect(storageAuthTokenRemove).toHaveBeenCalledTimes(1);
    });

    it("should not flag the session as expired after a manual sign out", async () => {
      const { result } = await renderLoggedInAuth();

      await act(async () => {
        await result.current.signOut();
      });
      await act(async () => {
        await mockUnauthorizedHandler();
      });

      expect(result.current.sessionExpired).toBe(false);
    });
  });

  describe("sign in", () => {
    it("should clear the local database when a different user signs in", async () => {
      mockStoredSession({ lastUserId: ana.id });
      mockSignInResponse(bruno);
      const { result } = await renderAuth();

      await act(async () => {
        await result.current.signIn(bruno.email, "secret");
      });

      expect(clearDatabase).toHaveBeenCalledTimes(1);
      expect(
        (clearDatabase as jest.Mock).mock.invocationCallOrder[0],
      ).toBeLessThan((storageUserSave as jest.Mock).mock.invocationCallOrder[0]);
      expect(result.current.user).toEqual(bruno);
    });

    it("should not sign in when the previous user data cannot be cleared", async () => {
      mockStoredSession({ lastUserId: ana.id });
      mockSignInResponse(bruno);
      (clearDatabase as jest.Mock).mockRejectedValueOnce(new Error("SQLITE_BUSY"));
      const { result } = await renderAuth();

      await act(async () => {
        await expect(
          result.current.signIn(bruno.email, "secret"),
        ).rejects.toThrow("SQLITE_BUSY");
      });

      expect(storageUserSave).not.toHaveBeenCalled();
      expect(storageLastUserIdSave).not.toHaveBeenCalled();
      expect(result.current.user).toBeNull();
    });

    it("should clear the local database when signing in without a previous user", async () => {
      mockSignInResponse(ana);
      const { result } = await renderAuth();

      await act(async () => {
        await result.current.signIn(ana.email, "secret");
      });

      expect(clearDatabase).toHaveBeenCalledTimes(1);
    });

    it("should keep the local database when the same user signs in again", async () => {
      mockStoredSession({ lastUserId: ana.id });
      mockSignInResponse(ana);
      const { result } = await renderAuth();

      await act(async () => {
        await result.current.signIn(ana.email, "secret");
      });

      expect(clearDatabase).not.toHaveBeenCalled();
      expect(storageAuthTokenSave).toHaveBeenCalledWith({ token: "token-user-1" });
      expect(result.current.user).toEqual(ana);
    });

    it("should save the last user id and clear the expired flag after signing in", async () => {
      const { result } = await renderLoggedInAuth();
      await act(async () => {
        await mockUnauthorizedHandler();
      });
      mockSignInResponse(ana);

      await act(async () => {
        await result.current.signIn(ana.email, "secret");
      });

      expect(storageLastUserIdSave).toHaveBeenCalledWith(ana.id);
      expect(result.current.sessionExpired).toBe(false);
    });
  });

  describe("manual sign out", () => {
    it("should clear everything and the last user id on manual sign out", async () => {
      const { result } = await renderLoggedInAuth();

      await act(async () => {
        await result.current.signOut();
      });

      expect(clearDatabase).toHaveBeenCalledTimes(1);
      expect(storageUserRemove).toHaveBeenCalledTimes(1);
      expect(storageAuthTokenRemove).toHaveBeenCalledTimes(1);
      expect(storageLastUserIdRemove).toHaveBeenCalledTimes(1);
      expect(result.current.user).toBeNull();
      expect(result.current.sessionExpired).toBe(false);
    });
  });

  describe("restoring the session", () => {
    it("should flag the session as expired when restored without token but with a last user id", async () => {
      mockStoredSession({ lastUserId: ana.id });

      const { result } = await renderAuth();

      expect(result.current.user).toBeNull();
      expect(result.current.sessionExpired).toBe(true);
    });

    it("should not flag the session as expired on a fresh install", async () => {
      const { result } = await renderAuth();

      expect(result.current.sessionExpired).toBe(false);
    });

    it("should save the last user id when restoring a session without it", async () => {
      mockStoredSession({ user: ana, token: "token-1" });

      await renderAuth();

      expect(storageLastUserIdSave).toHaveBeenCalledWith(ana.id);
    });

    it("should not save the last user id again when it is already stored", async () => {
      await renderLoggedInAuth();

      expect(storageLastUserIdSave).not.toHaveBeenCalled();
    });
  });
});
