import { TripDetails } from "@/server/trip-server";
import dayjs from "dayjs";
import { router } from "expo-router";
import { Image, Text, TouchableOpacity, View } from "react-native";
import { Badge } from "./badge";

type TripItemProps = {
  trip: TripDetails;
};

export function TripItem({ trip }: TripItemProps) {
  function handlePress() {
    router.push(`/trip/${trip.tripId}`);
  }

  return (
    <TouchableOpacity
      activeOpacity={0.7}
      onPress={handlePress}
      className="flex-row bg-zinc-900 rounded-xl p-3 mb-4"
    >
      {trip.image ? (
        <Image source={{ uri: trip.image }} className="w-16 h-16 rounded-lg" />
      ) : (
        <View className="w-16 h-16 rounded-lg bg-gray-400" />
      )}

      <View className="ml-4 flex-1">
        <View className="flex-row items-center justify-between">
          <Text className="text-zinc-100 font-semibold">
            {trip.destination}
          </Text>

          <Badge startsAt={trip.startsAt} endsAt={trip.endsAt} />
        </View>

        <Text className="text-zinc-400">
          {dayjs(trip.startsAt).date()} a {dayjs(trip.endsAt).date()} de{" "}
          {dayjs(trip.endsAt).format("MMMM")}.
        </Text>
      </View>
    </TouchableOpacity>
  );
}
