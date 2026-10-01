import { api } from "./api"
import { readCreatedId } from "./read-created-id"

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
  try {
    const { data } = await api.post<unknown>(`/trips/activity/register`, {
      occursAt,
      title,
      tripId,
    })

    return { activityId: readCreatedId(data, "activityId") }
  } catch (error) {
    throw error
  }
}

async function getActivitiesByTripId(tripId: string) {
  try {
    const { data } = await api.get<ActivityResponse>(
      `/trips/${tripId}/activities`
    )
    return data.activities
  } catch (error) {
    throw error
  }
}

export const activitiesServer = { create, getActivitiesByTripId }