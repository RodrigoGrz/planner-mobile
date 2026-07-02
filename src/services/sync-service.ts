import { mergeActivitiesFromServer } from "@/repositories/activity-repository";
import { mergeLinksFromServer } from "@/repositories/link-repository";
import { replaceParticipantsByTripId } from "@/repositories/participant-repository";
import {
  getTravelerTrips,
  getTripById,
  mergeTravelerTripsFromServer,
  resolveLocalTripId,
  resolveRemoteId,
  setNextTripId,
  upsertTripDetail,
} from "@/repositories/trip-repository";
import { activitiesServer } from "@/server/activities-server";
import { linksServer } from "@/server/links-server";
import { participantsServer } from "@/server/participants-server";
import { tripServer } from "@/server/trip-server";

export async function syncTravelerTrips() {
  const [allTripsResponse, nextTripResponse] = await Promise.all([
    tripServer.getAllTripsByTraveler(),
    tripServer.getNextTripsByTraveler(),
  ]);

  const trips = allTripsResponse.data.trips;
  const nextTrip = nextTripResponse.data.nextTrip;

  await mergeTravelerTripsFromServer(trips);
  await setNextTripId(nextTrip?.tripId ?? null);

  return { trips, nextTrip };
}

export async function syncTripDetail(tripId: string) {
  const remoteTripId = await resolveRemoteId(tripId);
  const trip = await tripServer.getById(remoteTripId);
  await upsertTripDetail(trip);
  return trip;
}

export async function syncActivities(tripId: string) {
  const remoteTripId = await resolveRemoteId(tripId);
  const activities = await activitiesServer.getActivitiesByTripId(remoteTripId);
  await mergeActivitiesFromServer(tripId, activities);
  return activities;
}

export async function syncTripDetails(tripId: string) {
  const remoteTripId = await resolveRemoteId(tripId);
  const localTripId = await resolveLocalTripId(tripId);

  const [links, participants] = await Promise.all([
    linksServer.getLinksByTripId(remoteTripId),
    participantsServer.getByTripId(remoteTripId),
  ]);

  await Promise.all([
    mergeLinksFromServer(tripId, links),
    replaceParticipantsByTripId(localTripId, participants),
  ]);

  return { links, participants };
}

export async function hasLocalTravelerTrips() {
  const trips = await getTravelerTrips();
  return trips.length > 0;
}

export async function hasLocalTrip(tripId: string) {
  const trip = await getTripById(tripId);
  return trip !== null;
}

export {
  mergeActivitiesFromServer,
  mergeLinksFromServer,
  mergeTravelerTripsFromServer,
};
