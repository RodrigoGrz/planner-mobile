import * as Crypto from "expo-crypto";

export function generateLocalId(): string {
  return Crypto.randomUUID();
}
