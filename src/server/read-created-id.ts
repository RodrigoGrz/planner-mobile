export function readCreatedId(data: unknown, key: string): string | null {
  if (typeof data !== "object" || data === null) {
    return null;
  }

  const value = (data as Record<string, unknown>)[key];

  return typeof value === "string" && value.length > 0 ? value : null;
}
