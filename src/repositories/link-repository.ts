import { getDatabase } from "@/database/database";
import { setSyncMetadata } from "@/database/sync-metadata";
import { Link } from "@/server/links-server";

type LinkRow = {
  id: string;
  trip_id: string;
  title: string;
  url: string;
};

function mapLinkRow(row: LinkRow): Link {
  return {
    id: row.id,
    title: row.title,
    url: row.url,
  };
}

export async function getLinksByTripId(tripId: string) {
  const db = await getDatabase();

  const rows = await db.getAllAsync<LinkRow>(
    "SELECT * FROM links WHERE trip_id = ? ORDER BY title ASC",
    [tripId],
  );

  return rows.map(mapLinkRow);
}

export async function replaceLinksByTripId(tripId: string, links: Link[]) {
  const db = await getDatabase();

  await db.withTransactionAsync(async () => {
    await db.runAsync("DELETE FROM links WHERE trip_id = ?", [tripId]);

    for (const link of links) {
      await db.runAsync(
        "INSERT INTO links (id, trip_id, title, url) VALUES (?, ?, ?, ?)",
        [link.id, tripId, link.title, link.url],
      );
    }
  });

  await setSyncMetadata(`links:${tripId}`);
}
