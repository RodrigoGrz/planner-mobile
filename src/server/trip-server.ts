import { api } from "./api";
import { routes } from "./routes";
import { logger } from "@/utils/logger";

export type TripDetails = {
  participantId: string;
  tripId: string;
  destination: string;
  startsAt: string;
  endsAt: string;
  isConfirmed: boolean;
  coverImageUrl: string | null;
};

export type TripByID = {
  id: string;
  destination: string;
  startsAt: Date;
  endsAt: Date;
  coverImageUrl?: string | null;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
};

type TripCreate = Omit<
  TripDetails,
  "id" | "isConfirmed" | "participantId" | "tripId" | "coverImageUrl"
> & {
  emails_to_invite: string[];
};

type TripByIDResponse = Omit<TripByID, "startsAt" | "endsAt" | "createdAt" | "updatedAt"> & {
  startsAt: string | Date;
  endsAt: string | Date;
  createdAt: string | Date;
  updatedAt: string | Date;
};

function parseTripById(trip: TripByIDResponse): TripByID {
  return {
    ...trip,
    startsAt: new Date(trip.startsAt),
    endsAt: new Date(trip.endsAt),
    createdAt: new Date(trip.createdAt),
    updatedAt: new Date(trip.updatedAt),
  };
}

async function getById(id: string) {
  const { data } = await api.get<{ trip: TripByIDResponse }>(routes.trip(id));

  return parseTripById(data.trip);
}

async function create({
  destination,
  startsAt,
  endsAt,
  emails_to_invite,
}: TripCreate) {
  try {
    const { data } = await api.post<{ tripId: string }>(routes.trips(), {
      destination,
      startsAt,
      endsAt,
      emailsToInvite: emails_to_invite,
    });

    return data;
  } catch (error) {
    logger.error(error);
    throw error;
  }
}

async function update({
  tripId,
  destination,
  startsAt,
  endsAt,
}: Omit<
  TripDetails,
  "isConfirmed" | "image" | "participantId" | "coverImageUrl"
>) {
  await api.put(routes.trip(tripId), {
    destination,
    startsAt,
    endsAt,
  });
}

async function getAllTripsByTraveler() {
  return api.get(routes.myTrips());
}

async function getNextTripsByTraveler() {
  return api.get(routes.myNextTrip());
}

async function uploadTripImage(tripId: string, selectedImage: string) {
  const formData = new FormData();

  formData.append("file", {
    uri: selectedImage!,
    name: "cover.jpg",
    type: "image/jpeg",
  } as any);

  await api.put(routes.tripCoverImage(tripId), formData, {
    headers: {
      "Content-Type": "multipart/form-data",
    },
  });
}

export const tripServer = {
  getById,
  create,
  update,
  getAllTripsByTraveler,
  getNextTripsByTraveler,
  uploadTripImage,
};
