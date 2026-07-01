import AsyncStorage from '@react-native-async-storage/async-storage';

import { AUTH_TOKE_STORAGE } from './config';

type StorageAuthTokenProps = {
    token: string;
}

export async function storageAuthTokenSave({ token }: StorageAuthTokenProps) {
    await AsyncStorage.setItem(AUTH_TOKE_STORAGE, JSON.stringify({ token }));
}

export async function storageAuthTokenGet() {
    try {
        const response = await AsyncStorage.getItem(AUTH_TOKE_STORAGE);

        if (!response) {
            return { token: undefined };
        }

        const parsed = JSON.parse(response) as Partial<StorageAuthTokenProps>;

        return { token: parsed.token };
    } catch {
        await AsyncStorage.removeItem(AUTH_TOKE_STORAGE);
        return { token: undefined };
    }
}

export async function storageAuthTokenRemove() {
    await AsyncStorage.removeItem(AUTH_TOKE_STORAGE);
}