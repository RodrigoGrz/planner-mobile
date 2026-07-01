import { Button } from "@/components/button";
import { Loading } from "@/components/loading";
import { NextTrip } from "@/components/nextTrip";
import { SyncingLabel } from "@/components/syncing-label";
import { TripItem } from "@/components/tripItem";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import { router } from "expo-router";
import { FlatList, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Index() {
  const { signOut } = useAuth();
  const { trips, nextTrip, status } = useTrips();

  if (status === "loading") {
    return <Loading />;
  }

  return (
    <SafeAreaView className="flex-1 bg-zinc-950">
      <View className="px-5 pt-4">
        <View className="flex-row items-center justify-between">
          <View className="flex-1">
            <Text className="text-zinc-100 text-2xl font-bold">
              Explore suas viagens
            </Text>
            <SyncingLabel visible={status === "syncing"} />
          </View>
          <TouchableOpacity activeOpacity={0.7} onPress={signOut}>
            <Text className="text-lime-300 text-base">Sair</Text>
          </TouchableOpacity>
        </View>

        {nextTrip && <NextTrip trip={nextTrip} />}

        <Text className="text-zinc-400 mt-8 mb-3">Minhas viagens</Text>
      </View>

      {status === "error" ? (
        <View className="flex-1 items-center px-5">
          <Text className="text-zinc-100 font-bold mt-5 text-center">
            Não foi possível carregar suas viagens. Verifique sua conexão.
          </Text>
        </View>
      ) : (
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
      )}

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
