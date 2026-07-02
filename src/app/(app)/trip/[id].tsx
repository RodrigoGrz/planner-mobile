import dayjs from "dayjs";
import { router, useLocalSearchParams } from "expo-router";
import { useEffect, useState } from "react";
import { Alert, Keyboard, Text, TouchableOpacity, View } from "react-native";
import { DateData } from "react-native-calendars";

import { Button } from "@/components/button";
import { Calendar } from "@/components/calendar";
import { Input } from "@/components/input";
import { Loading } from "@/components/loading";
import { Modal } from "@/components/modal";
import { SyncingLabel } from "@/components/syncing-label";
import { useNetwork } from "@/contexts/NetworkContext";
import { useTripScreenSync } from "@/hooks/useTripScreenSync";
import { useTrip } from "@/hooks/useTrip";
import { mutationService } from "@/services/mutation-service";
import { participantsServer } from "@/server/participants-server";
import { colors } from "@/styles/colors";
import { logger } from "@/utils/logger";
import { toApiDate } from "@/utils/to-api-date";
import { calendarUtils, DatesSelected } from "@/utils/calendarUtils";
import { validateInput } from "@/utils/validateInput";
import {
  CalendarRange,
  Calendar as IconCalendar,
  Info,
  Mail,
  MapPin,
  Settings2,
  User,
} from "lucide-react-native";
import { Activities } from "./activities";
import { Details } from "./details";

export type TripData = {
  id: string;
  destination: string;
  startsAt: Date;
  endsAt: Date;
  ownerName: string;
  createdAt: Date;
  updatedAt: Date;
  when: string;
};

enum MODAL {
  NONE = 0,
  UPDATE_TRIP = 1,
  CALENDAR = 2,
  CONFIRM_ATTENDANCE = 3,
}

function buildTripData(trip: NonNullable<ReturnType<typeof useTrip>["trip"]>): TripData {
  const maxLengthDestination = 14;
  const destinationText =
    trip.destination.length > maxLengthDestination
      ? trip.destination.slice(0, maxLengthDestination) + "..."
      : trip.destination;

  const starts_at = dayjs(trip.startsAt).format("DD");
  const ends_at = dayjs(trip.endsAt).format("DD");
  const month = dayjs(trip.startsAt).format("MMM");

  return {
    id: trip.id,
    destination: trip.destination,
    startsAt: trip.startsAt,
    endsAt: trip.endsAt,
    ownerName: trip.ownerName,
    createdAt: trip.createdAt,
    updatedAt: trip.updatedAt,
    when: `${destinationText} de ${starts_at} a ${ends_at} de ${month}.`,
  };
}

export default function Trip() {
  const { isOnline } = useNetwork();
  const tripParams = useLocalSearchParams<{
    id: string;
    participants?: string;
  }>();

  const { trip: tripFromDb, status, refresh } = useTrip(tripParams.id);

  useTripScreenSync(tripParams.id);

  const [isUpdatingTrip, setIsUpdatingTrip] = useState(false);
  const [isConfirmingAttendance, setIsConfirmingAttendance] = useState(false);
  const [showModal, setShowModal] = useState(MODAL.NONE);
  const [option, setOption] = useState<"activity" | "details">("activity");
  const [destination, setDestination] = useState("");
  const [selectedDates, setSelectedDates] = useState({} as DatesSelected);
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");

  const trip = tripFromDb ? buildTripData(tripFromDb) : null;

  useEffect(() => {
    if (tripParams.participants) {
      setShowModal(MODAL.CONFIRM_ATTENDANCE);
    }

    if (!tripParams.id) {
      router.back();
    }
  }, [tripParams.id, tripParams.participants]);

  useEffect(() => {
    if (!tripFromDb) {
      return;
    }

    setDestination(tripFromDb.destination);

    const startsAtCalendar = {
      dateString: dayjs(tripFromDb.startsAt).format("YYYY-MM-DD"),
      day: dayjs(tripFromDb.startsAt).date(),
      month: dayjs(tripFromDb.startsAt).month() + 1,
      year: dayjs(tripFromDb.startsAt).year(),
      timestamp: dayjs(tripFromDb.startsAt).valueOf(),
    };

    const endsAtCalendar = {
      dateString: dayjs(tripFromDb.endsAt).format("YYYY-MM-DD"),
      day: dayjs(tripFromDb.endsAt).date(),
      month: dayjs(tripFromDb.endsAt).month() + 1,
      year: dayjs(tripFromDb.endsAt).year(),
      timestamp: dayjs(tripFromDb.endsAt).valueOf(),
    };

    setSelectedDates(
      calendarUtils.createFromInterval(startsAtCalendar, endsAtCalendar),
    );
  }, [tripFromDb]);

  function handleSelectDate(selectedDay: DateData) {
    const dates = calendarUtils.orderStartsAtAndEndsAt({
      startsAt: selectedDates.startsAt,
      endsAt: selectedDates.endsAt,
      selectedDay,
    });

    setSelectedDates(dates);
  }

  async function handleUpdateTrip() {
    try {
      if (!tripParams.id || !trip) {
        return;
      }

      if (!destination || !selectedDates.startsAt || !selectedDates.endsAt) {
        return Alert.alert(
          "Atualizar viagem",
          "Lembre-se de, além de preencher o destino, selecione a data de início e fim da viagem.",
        );
      }

      setIsUpdatingTrip(true);

      await mutationService.updateTrip({
        tripId: trip.id,
        destination,
        startsAt: toApiDate(selectedDates.startsAt.dateString),
        endsAt: toApiDate(selectedDates.endsAt.dateString),
      });

      Alert.alert(
        "Atualizar viagem",
        isOnline
          ? "Viagem atualizada com sucesso!"
          : "Alterações salvas offline. Serão sincronizadas quando houver conexão.",
        [
          {
            text: "OK",
            onPress: () => {
              setShowModal(MODAL.NONE);
              refresh();
            },
          },
        ],
      );
    } catch (error) {
      logger.error(error);
    } finally {
      setIsUpdatingTrip(false);
    }
  }

  async function handleConfirmAttendance() {
    if (!isOnline) {
      return Alert.alert(
        "Sem conexão",
        "Confirmar presença requer conexão com a internet.",
      );
    }

    try {
      if (!tripParams.id || !tripParams.participants) {
        return;
      }

      if (!guestName.trim() || !guestEmail.trim()) {
        return Alert.alert(
          "Confirmação",
          "Preencha nome e e-mail para confirmar a viagem!",
        );
      }

      if (!validateInput.email(guestEmail.trim())) {
        return Alert.alert("Confirmação", "E-mail inválido");
      }

      setIsConfirmingAttendance(true);

      await participantsServer.confirmTripByParticipantId({
        participantId: tripParams.participants,
        name: guestName,
        email: guestEmail.trim(),
      });

      Alert.alert("Confirmação", "Viagem confirmada com sucesso!");

      setShowModal(MODAL.NONE);
    } catch (error) {
      logger.error(error);
      Alert.alert("Confirmação", "Não foi possível confirmar!");
    } finally {
      setIsConfirmingAttendance(false);
    }
  }

  async function handleRemoveTrip() {
    Alert.alert("Remover viagem", "Tem certeza que deseja remover a viagem", [
      {
        text: "Não",
        style: "cancel",
      },
      {
        text: "Sim",
        onPress: async () => {
          router.navigate("/");
        },
      },
    ]);
  }

  if (status === "loading" && !trip) {
    return <Loading />;
  }

  if (!trip) {
    if (status === "error") {
      return (
        <View className="flex-1 px-5 pt-16 items-center">
          <Text className="text-zinc-100 text-center font-semibold">
            Não foi possível carregar a viagem. Verifique sua conexão.
          </Text>
        </View>
      );
    }

    return <Loading />;
  }

  return (
    <View className="flex-1 px-5 pt-16">
      <Input variant="tertiary">
        <MapPin color={colors.zinc[400]} size={20} />
        <Input.Field value={trip.when} readOnly />

        <TouchableOpacity
          activeOpacity={0.6}
          className="w-9 h-9 bg-zinc-800 items-center justify-center rounded"
          onPress={() => setShowModal(MODAL.UPDATE_TRIP)}
        >
          <Settings2 color={colors.zinc[400]} size={20} />
        </TouchableOpacity>
      </Input>

      <SyncingLabel visible={status === "syncing"} />

      <View className="flex-1" style={{ display: option === "activity" ? "flex" : "none" }}>
        <Activities tripDetails={trip} />
      </View>

      <View className="flex-1" style={{ display: option === "details" ? "flex" : "none" }}>
        <Details tripId={trip.id} />
      </View>

      <View className="w-full absolute -bottom-1 self-center justify-end pb-5 z-10 bg-zinc-950">
        <View className="w-full flex-row bg-zinc-900 p-4 rounded-lg border border-zinc-800 gap-2">
          <Button
            className="flex-1"
            onPress={() => setOption("activity")}
            variant={option === "activity" ? "primary" : "secondary"}
          >
            <CalendarRange
              color={
                option === "activity" ? colors.lime[950] : colors.zinc[200]
              }
              size={20}
            />
            <Button.Title>Atividades</Button.Title>
          </Button>

          <Button
            className="flex-1"
            onPress={() => setOption("details")}
            variant={option === "details" ? "primary" : "secondary"}
          >
            <Info
              color={option === "details" ? colors.lime[950] : colors.zinc[200]}
              size={20}
            />
            <Button.Title>Detalhes</Button.Title>
          </Button>
        </View>
      </View>

      <Modal
        title="Atualizar viagem"
        subtitle="Somente quem criou a viagem pode editar."
        visible={showModal == MODAL.UPDATE_TRIP}
        onClose={() => setShowModal(MODAL.NONE)}
      >
        <View className="gap-2 my-4">
          <Input variant="secondary">
            <MapPin color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Para onde?"
              onChangeText={setDestination}
              value={destination}
            />
          </Input>

          <Input variant="secondary">
            <IconCalendar color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Quando?"
              value={selectedDates.formatDatesInText}
              onPressIn={() => setShowModal(MODAL.CALENDAR)}
              onFocus={() => Keyboard.dismiss()}
            />
          </Input>

          <Button onPress={handleUpdateTrip} isLoading={isUpdatingTrip}>
            <Button.Title>Atualizar</Button.Title>
          </Button>

          <TouchableOpacity activeOpacity={0.8} onPress={handleRemoveTrip}>
            <Text className="text-red-400 text-center mt-6">
              Remover viagem
            </Text>
          </TouchableOpacity>
        </View>
      </Modal>

      <Modal
        title="Selecionar datas"
        subtitle="Selecione a data de ida e volta da viagem"
        visible={showModal === MODAL.CALENDAR}
        onClose={() => setShowModal(MODAL.NONE)}
      >
        <View className="gap-4 mt-4">
          <Calendar
            minDate={dayjs().toISOString()}
            onDayPress={handleSelectDate}
            markedDates={selectedDates.dates}
          />

          <Button onPress={() => setShowModal(MODAL.UPDATE_TRIP)}>
            <Button.Title>Confirmar</Button.Title>
          </Button>
        </View>
      </Modal>

      <Modal
        title="Confirmar presença"
        visible={showModal === MODAL.CONFIRM_ATTENDANCE}
      >
        <View className="gap-4 mt-4">
          <Text className="text-zinc-400 font-regular leading-6">
            Você foi convidado (a) para participar de uma viagem para
            <Text className="font-semibold text-zinc-100">
              {" "}
              {trip.destination}{" "}
            </Text>
            nas datas de{" "}
            <Text className="font-semibold text-zinc-100">
              {dayjs(trip.startsAt).date()} a {dayjs(trip.endsAt).date()} de{" "}
              {dayjs(trip.endsAt).format("MMMM")}. {"\n\n"}
            </Text>
            Para confirmar sua presença na viagem, preencha os dados abaixo:
          </Text>

          <Input variant="secondary">
            <User color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="Seu nome completo"
              onChangeText={setGuestName}
            />
          </Input>

          <Input variant="secondary">
            <Mail color={colors.zinc[400]} size={20} />
            <Input.Field
              placeholder="E-mail de confirmação"
              onChangeText={setGuestEmail}
            />
          </Input>

          <Button
            isLoading={isConfirmingAttendance}
            onPress={handleConfirmAttendance}
          >
            <Button.Title>Confirmar minha presença</Button.Title>
          </Button>
        </View>
      </Modal>
    </View>
  );
}
