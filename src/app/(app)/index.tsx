import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { NextTrip } from "@/components/nextTrip";
import { TripItem } from "@/components/tripItem";
import { useAuth } from "@/hooks/useAuth";
import { TripDetails, tripServer } from "@/server/trip-server";
import { router } from "expo-router";
import { useEffect, useState } from "react";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const { signOut } = useAuth();
  const [isLoading, setIsLoading] = useState(true);
  const [trips, setTrips] = useState<TripDetails[]>([]);
  const [nextTrip, setNextTrip] = useState<TripDetails | null>(null);

  async function getTrips() {
    try {
      setIsLoading(true);

      const { data: dataAllTrips } = await tripServer.getAllTripsByTraveler();
      const { data: dataNextTrip } = await tripServer.getNextTripsByTraveler();

      setTrips(dataAllTrips.trips);
      setNextTrip(dataNextTrip.nextTrip);
    } catch (error) {
      console.log(error);
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    getTrips();
  }, []);

  return isLoading ? (
    <Loading />
  ) : (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <Text className="text-zinc-100 text-2xl font-bold">
            Explore suas viagens
          </Text>
          <TouchableOpacity activeOpacity={0.7} onPress={signOut}>
            <Text className="text-lime-300 text-base">Sair</Text>
          </TouchableOpacity>
        </View>

        {nextTrip && <NextTrip trip={nextTrip} />}

        <Text className="text-zinc-400 mt-8 mb-3">Minhas viagens</Text>
      </View>

      <FlatList
        keyExtractor={(item) => item.tripId}
        contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 20 }}
        data={trips}
        renderItem={(trip) => (
          <TripItem key={trip.item.tripId} trip={trip.item} />
        )}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View className="flex-1 items-center">
            <Text className="text-zinc-100 font-bold mt-5">
              Nenhuma viagem encontrada
            </Text>
          </View>
        }
      />

      <View className="px-5 pb-6 pt-3">
        <Button
          className="w-full"
          onPress={() => {
            router.push("/(app)/trip/create");
          }}
        >
          <Text className="text-zinc-950 font-semibold">Criar nova viagem</Text>
        </Button>
      </View>
    </SafeAreaView>
  );
}
