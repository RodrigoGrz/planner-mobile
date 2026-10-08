import { api } from "./api"
import { readCreatedId } from "./read-created-id"
import { routes } from "./routes"

type Activity = {
  id: string
  occursAt: string
  title: string
}

type ActivityCreate = Omit<Activity, "id"> & {
  tripId: string
}

type ActivityResponse = {
  activities: {
    date: string
    activities: Activity[]
  }[]
}

async function create({ tripId, occursAt, title }: ActivityCreate) {
  const { data } = await api.post<unknown>(routes.tripActivities(tripId), {
    occursAt,
    title,
  })

  return { activityId: readCreatedId(data, "activityId") }
}

async function getActivitiesByTripId(tripId: string) {
  const { data } = await api.get<ActivityResponse>(routes.tripActivities(tripId))

  return data.activities
}

export const activitiesServer = { create, getActivitiesByTripId }
