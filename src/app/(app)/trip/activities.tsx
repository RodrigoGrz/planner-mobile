import { Activity, ActivityProps } from "@/components/activity";
import { Button } from "@/components/button";
import { Calendar } from "@/components/calendar";
import { Input } from "@/components/input";
import { Loading } from "@/components/loading";
import { Modal } from "@/components/modal";
import { SyncingLabel } from "@/components/syncing-label";
import { useNetwork } from "@/contexts/NetworkContext";
import { useActivities } from "@/hooks/useActivities";
import { activitiesServer } from "@/server/activities-server";
import { colors } from "@/styles/colors";
import dayjs from "dayjs";
import {
  Clock,
  Calendar as IconCalendar,
  PlusIcon,
  Tag,
} from "lucide-react-native";
import { useState } from "react";
import { Alert, Keyboard, SectionList, Text, View } from "react-native";
import { TripData } from "./[id]";

type Props = {
  tripDetails: TripData;
};

enum MODAL {
  NONE = 0,
  CALENDAR = 1,
  NEW_ACTIVITY = 2,
}

export function Activities({ tripDetails }: Props) {
  const { isOnline } = useNetwork();
  const { sections: tripActivities, status, refresh } = useActivities(
    tripDetails.id,
  );

  const [showModal, setShowModal] = useState(MODAL.NONE);
  const [isCreatingActivity, setIsCreatingActivity] = useState(false);
  const [activityTitle, setActivityTitle] = useState("");
  const [activityDate, setActivityDate] = useState("");
  const [activityHour, setActivityHour] = useState("");

  function resetNewActivityFields() {
    setActivityTitle("");
    setActivityDate("");
    setActivityHour("");
  }

  async function handleCreateTripACtivity() {
    if (!isOnline) {
      return Alert.alert(
        "Sem conexão",
        "Cadastrar atividades requer conexão com a internet.",
      );
    }

    try {
      if (!activityTitle || !activityDate || !activityHour) {
        Alert.alert("Cadastrar atividade", "Preencha todos os campos!");
      }

      setIsCreatingActivity(true);

      await activitiesServer.create({
        tripId: tripDetails.id,
        occursAt: dayjs(activityDate).add(Number(activityHour), "h").toString(),
        title: activityTitle,
      });

      Alert.alert("Nova Atividade", "Nova atividade cadastrada com sucesso!");

      await refresh();

      resetNewActivityFields();

      setShowModal(MODAL.NONE);
    } catch (error) {
      console.log(error);
    } finally {
      setIsCreatingActivity(false);
    }
  }

  const isInitialLoading = status === "loading" && tripActivities.length === 0;

  return (
    <View className="flex-1">
      <View className="w-fll flex-row mt-5 mb-6 items-center">
        <View className="flex-1">
          <Text className="text-zinc-50 text-2xl font-semibold">
            Atividades
          </Text>
          <SyncingLabel visible={status === "syncing"} />
        </View>

        <Button
          onPress={() => {
            if (!isOnline) {
              return Alert.alert(
                "Sem conexão",
                "Cadastrar atividades requer conexão com a internet.",
              );
            }
            setShowModal(MODAL.NEW_ACTIVITY);
          }}
          disabled={!isOnline}
        >
          <PlusIcon color={colors.lime[950]} size={20} />
          <Button.Title>Nova atividade</Button.Title>
        </Button>
      </View>

      {isInitialLoading ? (
        <Loading />
      ) : status === "error" ? (
        <Text className="text-zinc-400 font-regular text-base">
          Não foi possível carregar as atividades. Verifique sua conexão.
        </Text>
      ) : (
        <SectionList
          sections={tripActivities}
          keyExtractor={(item: ActivityProps) => item.id}
          renderItem={({ item }) => <Activity data={item} />}
          renderSectionHeader={({ section }) => (
            <View className="w-full">
              <Text className="text-zinc-50 text-2xl font-semibold py-2">
                Dia {section.title.dayNumber + " "}
                <Text className="text-zinc-500 text-base font-regular capitalize">
                  {section.title.dayName}
                </Text>
              </Text>

              {section.data.length === 0 && (
                <Text className="text-zinc-500 font-regular text-sm mb-8">
                  Nenhuma atividade cadastrada nessa data.
                </Text>
              )}
            </View>
          )}
          contentContainerClassName="gap-3 pb-48"
          showsVerticalScrollIndicator={false}
        />
      )}

      <Modal
        title="Cadastrar atividade"
        subtitle="Todos os convidados podem visualizar as atividades"
        visible={showModal === MODAL.NEW_ACTIVITY}
        onClose={() => setShowModal(MODAL.NONE)}
      >
        <View className="mt-4 mb-3">
          <Input variant="secondary">
            <Tag color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Qual atividade?"
              onChangeText={setActivityTitle}
              value={activityTitle}
            />
          </Input>

          <View className="w-full mt-2 flex-row gap-2">
            <Input variant="secondary" className="flex-1">
              <IconCalendar color={colors.zinc[400]} size={20} />
              <Input.Field
                placeholder="Data"
                onChangeText={setActivityTitle}
                value={
                  activityDate ? dayjs(activityDate).format("DD [de] MMM") : ""
                }
                onFocus={() => Keyboard.dismiss()}
                showSoftInputOnFocus={false}
                onPressIn={() => setShowModal(MODAL.CALENDAR)}
              />
            </Input>

            <Input variant="secondary" className="flex-1">
              <Clock color={colors.zinc[400]} size={20} />
              <Input.Field
                placeholder="Horário?"
                onChangeText={(text) =>
                  setActivityHour(text.replace(".", "").replace(",", ""))
                }
                value={activityHour}
                keyboardType="numeric"
                maxLength={2}
              />
            </Input>
          </View>
        </View>

        <Button
          onPress={handleCreateTripACtivity}
          isLoading={isCreatingActivity}
        >
          <Button.Title>Salvar atividade</Button.Title>
        </Button>
      </Modal>

      <Modal
        title="Selecionar data"
        subtitle="Selecione a data da atividade"
        visible={showModal === MODAL.CALENDAR}
        onClose={() => setShowModal(MODAL.NONE)}
      >
        <View className="gap-4 mt-4">
          <Calendar
            onDayPress={(day) => setActivityDate(day.dateString)}
            markedDates={{ [activityDate]: { selected: true } }}
            initialDate={tripDetails.startsAt.toString()}
            minDate={tripDetails.startsAt.toString()}
            maxDate={tripDetails.endsAt.toString()}
          />

          <Button onPress={() => setShowModal(MODAL.NEW_ACTIVITY)}>
            <Button.Title>Confirmar</Button.Title>
          </Button>
        </View>
      </Modal>
    </View>
  );
}
