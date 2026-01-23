import { api } from "./api";

export type Link = {
  id: string;
  title: string;
  url: string;
};

type LinkCreate = Omit<Link, "id"> & {
  tripId: string;
};

async function getLinksByTripId(tripId: string) {
  try {
    const { data } = await api.get<{ links: Link[] }>(`/trips/${tripId}/links`);
    return data.links;
  } catch (error) {
    throw error;
  }
}

async function create({ tripId, title, url }: LinkCreate) {
  try {
    const { data } = await api.post<{ linkId: string }>(
      `/trips/link/register`,
      { title, url, tripId },
    );

    return data;
  } catch (error) {
    throw error;
  }
}

export const linksServer = { getLinksByTripId, create };
