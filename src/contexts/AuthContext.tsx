import { ReactNode, createContext, useCallback, useEffect, useState } from "react";

import { UserDTO } from "@/dtos/user-dto";
import { api } from "@/server/api";
import {
    storageAuthTokenGet,
    storageAuthTokenRemove,
    storageAuthTokenSave,
} from "@/storage/auth-token";
import {
    storageUserGet,
    storageUserRemove,
    storageUserSave,
} from "@/storage/user";
import { clearDatabase } from "@/database/clear";

export type AuthContextDataProps = {
  user: UserDTO | null;
  updateUserProfile: (userUpdated: UserDTO) => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  isLoadingUserStorageData: boolean;
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

  async function userAndTokenUpdate(userData: UserDTO, token: string) {
    api.defaults.headers.common["Authorization"] = `Bearer ${token}`;

    setUser(userData);
  }

  async function storageUserAndTokenSave(userData: UserDTO, token: string) {
    try {
      setIsLoadingUserStorageData(true);

      await storageUserSave(userData);
      await storageAuthTokenSave({ token });
    } catch (error) {
      throw error;
    } finally {
      setIsLoadingUserStorageData(false);
    }
  }

  async function signIn(email: string, password: string) {
    try {
      const { data } = await api.post("/travelers/auth", { email, password });

      if (data.user && data.token) {
        await storageUserAndTokenSave(data.user, data.token);
        userAndTokenUpdate(data.user, data.token);
      }
    } catch (error) {
      throw error;
    } finally {
      setIsLoadingUserStorageData(false);
    }
  }

  const signOut = useCallback(async () => {
    try {
      setIsLoadingUserStorageData(true);

      setUser(null);
      delete api.defaults.headers.common["Authorization"];

      await Promise.all([
        clearDatabase(),
        storageUserRemove(),
        storageAuthTokenRemove(),
      ]);
    } catch (error) {
      console.warn("Failed to sign out cleanly:", error);
    } finally {
      setIsLoadingUserStorageData(false);
    }
  }, []);

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

      if (token && userLogged) {
        await userAndTokenUpdate(userLogged, token);
      } else {
        setUser(null);

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
    const subscribe = api.registerInterceptTokenManager(signOut);

    return () => {
      subscribe();
    };
  }, [signOut]);

  return (
    <AuthContext.Provider
      value={{
        user,
        updateUserProfile,
        signIn,
        signOut,
        isLoadingUserStorageData,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
