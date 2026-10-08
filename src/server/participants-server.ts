import { api } from "./api";
import { routes } from "./routes";

export type Participant = {
  id: string;
  name: string | null;
  email: string;
  isConfirmed: boolean;
};

async function getByTripId(tripId: string) {
  const { data } = await api.get<{ participants: Participant[] }>(
    routes.tripParticipants(tripId),
  );

  return data.participants;
}

export const participantsServer = { getByTripId };
