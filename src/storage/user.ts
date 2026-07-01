import AsyncStorage from '@react-native-async-storage/async-storage';

import { UserDTO } from '@/dtos/user-dto';
import { USER_STORAGE } from './config';

export async function storageUserSave(user: UserDTO) {
    await AsyncStorage.setItem(USER_STORAGE, JSON.stringify(user));
}

export async function storageUserGet() {
    try {
        const storage = await AsyncStorage.getItem(USER_STORAGE);

        if (!storage) {
            return null;
        }

        const user = JSON.parse(storage) as UserDTO;

        if (!user?.id || !user?.email) {
            await AsyncStorage.removeItem(USER_STORAGE);
            return null;
        }

        return user;
    } catch {
        await AsyncStorage.removeItem(USER_STORAGE);
        return null;
    }
}

export async function storageUserRemove() {
    await AsyncStorage.removeItem(USER_STORAGE);
}