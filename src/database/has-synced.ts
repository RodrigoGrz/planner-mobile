import { getSyncMetadata } from "./sync-metadata";

export async function hasSynced(key: string) {
  const metadata = await getSyncMetadata(key);
  return metadata !== null;
}
