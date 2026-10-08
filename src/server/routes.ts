export const routes = {
  sessions: () => "/sessions",
  travelers: () => "/travelers",
  trips: () => "/trips",
  trip: (tripId: string) => `/trips/${tripId}`,
  tripCoverImage: (tripId: string) => `/trips/${tripId}/cover-image`,
  tripLinks: (tripId: string) => `/trips/${tripId}/links`,
  tripActivities: (tripId: string) => `/trips/${tripId}/activities`,
  tripParticipants: (tripId: string) => `/trips/${tripId}/participants`,
  myTrips: () => "/me/trips",
  myNextTrip: () => "/me/trips/next",
};
