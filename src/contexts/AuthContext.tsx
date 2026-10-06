import {
  ReactNode,
  createContext,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";

import { UserDTO } from "@/dtos/user-dto";
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
import { clearDatabase } from "@/database/clear";
import { logger } from "@/utils/logger";

export type AuthContextDataProps = {
  user: UserDTO | null;
  updateUserProfile: (userUpdated: UserDTO) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoadingUserStorageData: boolean;
  sessionExpired: boolean;
};

type AuthContextProviderProps = {
  children: ReactNode;
};

export const AuthContext = createContext<AuthContextDataProps>(
  {} as AuthContextDataProps,
);

export function AuthContextProvider({ children }: AuthContextProviderProps) {
  const [user, setUser] = useState<UserDTO | null>(null);
  const [isLoadingUserStorageData, setIsLoadingUserStorageData] =
    useState(true);
  const [sessionExpired, setSessionExpired] = useState(false);
  const hasActiveSessionRef = useRef(false);

  async function userAndTokenUpdate(userData: UserDTO, token: string) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    hasActiveSessionRef.current = true;
    setUser(userData);
  }

  async function persistUserSession(userData: UserDTO, token: string) {
    await storageUserSave(userData);
    await storageAuthTokenSave({ token });
  }

  async function signIn(email: string, password: string) {
    const { data } = await api.post("/travelers/auth", { email, password });

    if (data.user && data.token) {
      const lastUserId = await storageLastUserIdGet();

      if (lastUserId !== data.user.id) {
        await clearDatabase();
      }

      await persistUserSession(data.user, data.token);
      await storageLastUserIdSave(data.user.id);
      setSessionExpired(false);
      await userAndTokenUpdate(data.user, data.token);
    }
  }

  const endSession = useCallback(() => {
    hasActiveSessionRef.current = false;
    setUser(null);
    delete api.defaults.headers.common["Authorization"];
  }, []);

  const signOut = useCallback(async () => {
    try {
      setIsLoadingUserStorageData(true);

      endSession();
      setSessionExpired(false);

      await Promise.all([
        clearDatabase(),
        storageUserRemove(),
        storageAuthTokenRemove(),
        storageLastUserIdRemove(),
      ]);
    } catch (error) {
      logger.warn("Failed to sign out cleanly:", error);
    } finally {
      setIsLoadingUserStorageData(false);
    }
  }, [endSession]);

  const expireSession = useCallback(async () => {
    if (!hasActiveSessionRef.current) {
      return;
    }

    endSession();
    setSessionExpired(true);

    try {
      await Promise.all([storageUserRemove(), storageAuthTokenRemove()]);
    } catch (error) {
      logger.warn("Failed to expire the session cleanly:", error);
    }
  }, [endSession]);

  async function updateUserProfile(userUpdate: UserDTO) {
    try {
      setUser(userUpdate);
      await storageUserSave(userUpdate);
    } catch (error) {
      throw error;
    }
  }

  async function loadUserData() {
    try {
      setIsLoadingUserStorageData(true);

      const userLogged = await storageUserGet();
      const { token } = await storageAuthTokenGet();

      const lastUserId = await storageLastUserIdGet();

      if (token && userLogged) {
        if (!lastUserId) {
          await storageLastUserIdSave(userLogged.id);
        }

        await userAndTokenUpdate(userLogged, token);
      } else {
        setUser(null);
        setSessionExpired(Boolean(lastUserId));

        if (token || userLogged) {
          await Promise.all([storageUserRemove(), storageAuthTokenRemove()]);
        }
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoadingUserStorageData(false);
    }
  }

  useEffect(() => {
    loadUserData();
  }, []);

  useEffect(() => {
    const subscribe = api.registerInterceptTokenManager(expireSession);

    return () => {
      subscribe();
    };
  }, [expireSession]);

  return (
    <AuthContext.Provider
      value={{
        user,
        updateUserProfile,
        signIn,
        signOut,
        isLoadingUserStorageData,
        sessionExpired,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
