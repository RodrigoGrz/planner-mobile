import { api } from "./api";
import { readCreatedId } from "./read-created-id";
import { routes } from "./routes";

export type Link = {
  id: string;
  title: string;
  url: string;
};

type LinkCreate = Omit<Link, "id"> & {
  tripId: string;
};

async function getLinksByTripId(tripId: string) {
  const { data } = await api.get<{ links: Link[] }>(routes.tripLinks(tripId));

  return data.links;
}

async function create({ tripId, title, url }: LinkCreate) {
  const { data } = await api.post<unknown>(routes.tripLinks(tripId), {
    title,
    url,
  });

  return { linkId: readCreatedId(data, "linkId") };
}

export const linksServer = { getLinksByTripId, create };
