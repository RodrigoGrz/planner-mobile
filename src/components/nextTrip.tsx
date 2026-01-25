import { TripDetails } from "@/server/trip-server";
import dayjs from "dayjs";
import { Image, Text, View } from "react-native";

interface NextTripProps {
  trip: TripDetails;
}

export function NextTrip({ trip }: NextTripProps) {
  return (
    <View>
      <Text className="text-zinc-400 mt-6 mb-3">Próxima viagem</Text>

      <View className="w-full h-48 rounded-xl overflow-hidden">
        {trip.coverImageUrl ? (
          <Image
            source={{ uri: trip.coverImageUrl }}
            className="w-full h-full"
            resizeMode="cover"
          />
        ) : (
          <View className="w-full h-full rounded-lg bg-gray-400" />
        )}

        <View className="absolute bottom-0 w-full p-4 bg-black/60">
          <Text className="text-zinc-100 text-lg font-semibold">
            {trip.destination}
          </Text>
          <Text className="text-zinc-300">
            {dayjs(trip.startsAt).date()} a {dayjs(trip.endsAt).date()} de{" "}
            {dayjs(trip.endsAt).format("MMMM")}.
          </Text>
        </View>
      </View>
    </View>
  );
}
