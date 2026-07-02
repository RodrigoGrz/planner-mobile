import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SecureStore from "expo-secure-store";

import { AUTH_TOKEN_STORAGE, AUTH_TOKE_STORAGE } from "./config";

type StorageAuthTokenProps = {
  token: string;
};

let migrationDone = false;

async function migrateTokenFromAsyncStorage() {
  if (migrationDone) {
    return;
  }

  migrationDone = true;

  try {
    const legacy = await AsyncStorage.getItem(AUTH_TOKE_STORAGE);

    if (!legacy) {
      return;
    }

    const parsed = JSON.parse(legacy) as Partial<StorageAuthTokenProps>;

    if (parsed.token) {
      await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE, parsed.token);
    }

    await AsyncStorage.removeItem(AUTH_TOKE_STORAGE);
  } catch {
    await AsyncStorage.removeItem(AUTH_TOKE_STORAGE);
  }
}

export async function storageAuthTokenSave({ token }: StorageAuthTokenProps) {
  await migrateTokenFromAsyncStorage();
  await SecureStore.setItemAsync(AUTH_TOKEN_STORAGE, token);
}

export async function storageAuthTokenGet() {
  await migrateTokenFromAsyncStorage();

  try {
    const token = await SecureStore.getItemAsync(AUTH_TOKEN_STORAGE);

    if (!token) {
      return { token: undefined };
    }

    return { token };
  } catch {
    try {
      await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE);
    } catch {
      // Ignore cleanup errors for corrupted secure storage entries.
    }

    return { token: undefined };
  }
}

export async function storageAuthTokenRemove() {
  try {
    await SecureStore.deleteItemAsync(AUTH_TOKEN_STORAGE);
  } catch {
    // Ignore if the secure entry was never saved.
  }

  await AsyncStorage.removeItem(AUTH_TOKE_STORAGE);
}
