import AsyncStorage from "@react-native-async-storage/async-storage";

import {
  storageLastUserIdGet,
  storageLastUserIdRemove,
  storageLastUserIdSave,
} from "@/storage/user";

describe("storage/user", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
  });

  it("should save, read and remove the last user id", async () => {
    await storageLastUserIdSave("user-1");

    expect(await storageLastUserIdGet()).toBe("user-1");

    await storageLastUserIdRemove();

    expect(await storageLastUserIdGet()).toBeNull();
  });

  it("should return null when there is no last user id", async () => {
    expect(await storageLastUserIdGet()).toBeNull();
  });
});
