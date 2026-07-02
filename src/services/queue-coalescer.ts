import {
  CoalescedQueueItem,
  SyncOperation,
  SyncPayload,
  SyncQueueItem,
} from "@/types/sync";

function mergePayloads(current: SyncPayload, next: SyncPayload): SyncPayload {
  return { ...current, ...next };
}

export function coalesceQueueItems(items: SyncQueueItem[]): CoalescedQueueItem[] {
  const grouped = new Map<string, SyncQueueItem[]>();

  for (const item of items) {
    const key = `${item.entityType}:${item.entityId}`;
    const group = grouped.get(key) ?? [];
    group.push(item);
    grouped.set(key, group);
  }

  const coalesced: CoalescedQueueItem[] = [];

  for (const group of grouped.values()) {
    const sorted = [...group].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    const first = sorted[0];
    let operation: SyncOperation = first.operation;
    let payload = first.payload;
    const sourceQueueIds = sorted.map((item) => item.id);
    let dependsOnEntityId = first.dependsOnEntityId;

    for (const item of sorted.slice(1)) {
      if (operation === "create" && item.operation === "update") {
        payload = mergePayloads(payload, item.payload);
        continue;
      }

      if (operation === "update" && item.operation === "update") {
        payload = mergePayloads(payload, item.payload);
        continue;
      }

      operation = item.operation;
      payload = item.payload;
      dependsOnEntityId = item.dependsOnEntityId;
    }

    coalesced.push({
      entityType: first.entityType,
      operation,
      entityId: first.entityId,
      payload,
      dependsOnEntityId,
      sourceQueueIds,
    });
  }

  return coalesced.sort((a, b) => {
    const aCreatedAt = grouped.get(`${a.entityType}:${a.entityId}`)?.[0]?.createdAt ?? "";
    const bCreatedAt = grouped.get(`${b.entityType}:${b.entityId}`)?.[0]?.createdAt ?? "";
    return aCreatedAt.localeCompare(bCreatedAt);
  });
}
