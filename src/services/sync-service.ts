import { replaceActivitiesByTripId } from "@/repositories/activity-repository";
import { replaceLinksByTripId } from "@/repositories/link-repository";
import { replaceParticipantsByTripId } from "@/repositories/participant-repository";
import {
  getTravelerTrips,
  getTripById,
  setNextTripId,
  upsertTravelerTrips,
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

  await upsertTravelerTrips(trips);
  await setNextTripId(nextTrip?.tripId ?? null);

  return { trips, nextTrip };
}

export async function syncTripDetail(tripId: string) {
  const trip = await tripServer.getById(tripId);
  await upsertTripDetail(trip);
  return trip;
}

export async function syncActivities(tripId: string) {
  const activities = await activitiesServer.getActivitiesByTripId(tripId);
  await replaceActivitiesByTripId(tripId, activities);
  return activities;
}

export async function syncTripDetails(tripId: string) {
  const [links, participants] = await Promise.all([
    linksServer.getLinksByTripId(tripId),
    participantsServer.getByTripId(tripId),
  ]);

  await Promise.all([
    replaceLinksByTripId(tripId, links),
    replaceParticipantsByTripId(tripId, participants),
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
