import { api } from "./api";

export type TripDetails = {
  participantId: string;
  tripId: string;
  destination: string;
  startsAt: string;
  endsAt: string;
  isConfirmed: boolean;
  image?: string | null;
};

export type TripByID = {
  id: string;
  destination: string;
  startsAt: Date;
  endsAt: Date;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
};

type TripCreate = Omit<
  TripDetails,
  "id" | "isConfirmed" | "participantId" | "tripId"
> & {
  emails_to_invite: string[];
};

async function getById(id: string) {
  try {
    const { data } = await api.get<{ trip: TripByID }>(`/trips/${id}`);

    return data.trip;
  } catch (error) {
    throw error;
  }
}

async function create({
  destination,
  startsAt,
  endsAt,
  emails_to_invite,
}: TripCreate) {
  try {
    const { data } = await api.post<{ tripId: string }>("/trips/register", {
      destination,
      startsAt,
      endsAt,
      emailsToInvite: emails_to_invite,
    });

    return data;
  } catch (error) {
    console.log(error);
    throw error;
  }
}

async function update({
  tripId,
  destination,
  startsAt,
  endsAt,
}: Omit<TripDetails, "isConfirmed" | "image" | "participantId">) {
  try {
    await api.put(`/trips/${tripId}/update`, {
      destination,
      startsAt,
      endsAt,
    });
  } catch (error) {
    throw error;
  }
}

async function getAllTripsByTraveler() {
  try {
    return await api.get("/traveler/trips");
  } catch (error) {
    throw error;
  }
}

async function getNextTripsByTraveler() {
  try {
    return await api.get("/traveler/next/trip");
  } catch (error) {
    throw error;
  }
}

export const tripServer = {
  getById,
  create,
  update,
  getAllTripsByTraveler,
  getNextTripsByTraveler,
};
