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
import { useToast } from "@/contexts/ToastContext";
import { useTripScreenSync } from "@/hooks/useTripScreenSync";
import { useTrip } from "@/hooks/useTrip";
import { mutationService } from "@/services/mutation-service";
import { colors } from "@/styles/colors";
import { logger } from "@/utils/logger";
import { calendarUtils, DatesSelected } from "@/utils/calendarUtils";
import { ERROR_MESSAGES } from "@/utils/error-messages";
import {
  getLocalTodayString,
  getTripPeriodUpdateError,
  toTripDayString,
  tripDayjs,
} from "@/utils/trip-dates";
import { MAX_DESTINATION_LENGTH, validateInput } from "@/utils/validateInput";
import {
  CalendarRange,
  Calendar as IconCalendar,
  Info,
  MapPin,
  Settings2,
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

const PENDING_INVITE_MESSAGE =
  "Confirme sua presença pelo link enviado ao seu e-mail para ver atividades, links e participantes.";

enum MODAL {
  NONE = 0,
  UPDATE_TRIP = 1,
  CALENDAR = 2,
}

function buildTripData(trip: NonNullable<ReturnType<typeof useTrip>["trip"]>): TripData {
  const maxLengthDestination = 14;
  const destinationText =
    trip.destination.length > maxLengthDestination
      ? trip.destination.slice(0, maxLengthDestination) + "..."
      : trip.destination;

  const starts_at = tripDayjs(trip.startsAt).format("DD");
  const ends_at = tripDayjs(trip.endsAt).format("DD");
  const month = tripDayjs(trip.startsAt).format("MMM");

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

function TripHeader({ when, onEdit }: { when: string; onEdit?: () => void }) {
  return (
    <Input variant="tertiary">
      <MapPin color={colors.zinc[400]} size={20} />
      <Input.Field value={when} readOnly />

      {onEdit ? (
        <TouchableOpacity
          activeOpacity={0.6}
          accessibilityRole="button"
          accessibilityLabel="Editar viagem"
          className="w-9 h-9 bg-zinc-800 items-center justify-center rounded"
          onPress={onEdit}
        >
          <Settings2 color={colors.zinc[400]} size={20} />
        </TouchableOpacity>
      ) : null}
    </Input>
  );
}

export default function Trip() {
  const { isOnline } = useNetwork();
  const tripParams = useLocalSearchParams<{ id: string }>();

  const {
    trip: tripFromDb,
    status,
    refresh,
    isRemoved,
    isInvitePending,
  } = useTrip(tripParams.id);
  const { showError, showErrorMessage, showSuccess, showInfo } = useToast();

  useTripScreenSync(tripParams.id);

  const [isUpdatingTrip, setIsUpdatingTrip] = useState(false);
  const [showModal, setShowModal] = useState(MODAL.NONE);
  const [option, setOption] = useState<"activity" | "details">("activity");
  const [destination, setDestination] = useState("");
  const [selectedDates, setSelectedDates] = useState({} as DatesSelected);

  const trip = tripFromDb ? buildTripData(tripFromDb) : null;
  const today = getLocalTodayString();
  const currentStartDay = tripFromDb ? toTripDayString(tripFromDb.startsAt) : today;
  const editCalendarMinDate = currentStartDay < today ? currentStartDay : today;

  useEffect(() => {
    if (!tripParams.id) {
      router.back();
    }
  }, [tripParams.id]);

  useEffect(() => {
    if (isRemoved) {
      router.navigate("/");
    }
  }, [isRemoved]);

  useEffect(() => {
    if (!tripFromDb) {
      return;
    }

    setDestination(tripFromDb.destination);

    setSelectedDates(
      calendarUtils.createFromInterval(
        calendarUtils.toCalendarDate(tripFromDb.startsAt),
        calendarUtils.toCalendarDate(tripFromDb.endsAt),
      ),
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
        return showErrorMessage(
          "Preencha o destino e selecione as datas de início e fim da viagem.",
        );
      }

      if (!validateInput.destination(destination)) {
        return showErrorMessage(ERROR_MESSAGES.invalidDestination);
      }

      const periodError = getTripPeriodUpdateError({
        startsAt: selectedDates.startsAt.dateString,
        endsAt: selectedDates.endsAt.dateString,
        currentStartsAt: toTripDayString(trip.startsAt),
        currentEndsAt: toTripDayString(trip.endsAt),
      });

      if (periodError) {
        return showErrorMessage(periodError);
      }

      setIsUpdatingTrip(true);

      await mutationService.updateTrip({
        tripId: trip.id,
        destination: destination.trim(),
        startsAt: selectedDates.startsAt.dateString,
        endsAt: selectedDates.endsAt.dateString,
      });

      if (isOnline) {
        showSuccess("Viagem atualizada com sucesso!");
      } else {
        showInfo(
          "Alterações salvas offline. Serão sincronizadas quando houver conexão.",
        );
      }

      setShowModal(MODAL.NONE);
      refresh();
    } catch (error) {
      logger.error(error);
      showError(error, "Não foi possível atualizar a viagem.");
    } finally {
      setIsUpdatingTrip(false);
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

  if (isInvitePending) {
    return (
      <View className="flex-1 px-5 pt-16">
        <TripHeader when={trip.when} />

        <Text className="text-zinc-400 text-center mt-8 leading-6">
          {PENDING_INVITE_MESSAGE}
        </Text>
      </View>
    );
  }

  return (
    <View className="flex-1 px-5 pt-16">
      <TripHeader
        when={trip.when}
        onEdit={() => setShowModal(MODAL.UPDATE_TRIP)}
      />

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
              maxLength={MAX_DESTINATION_LENGTH}
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
            minDate={editCalendarMinDate}
            onDayPress={handleSelectDate}
            markedDates={selectedDates.dates}
          />

          <Button onPress={() => setShowModal(MODAL.UPDATE_TRIP)}>
            <Button.Title>Confirmar</Button.Title>
          </Button>
        </View>
      </Modal>
    </View>
  );
}
