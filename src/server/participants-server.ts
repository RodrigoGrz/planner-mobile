import { api } from "./api";

export type Participant = {
  id: string;
  name: string | null;
  email: string;
  isConfirmed: boolean;
};

async function getByTripId(tripId: string) {
  const { data } = await api.get<{ participants: Participant[] }>(
    `/trips/${tripId}/participants`,
  );

  return data.participants;
}

export const participantsServer = { getByTripId };
