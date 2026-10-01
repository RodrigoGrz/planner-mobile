import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import Trip from "@/app/(app)/trip/[id]";
import { ToastProvider } from "@/contexts/ToastContext";
import { participantsServer } from "@/server/participants-server";
import { mutationService } from "@/services/mutation-service";
import { AppError } from "@/utils/app-error";

let mockIsOnline = true;
let mockSearchParams: { id: string; participants?: string } = { id: "trip-1" };
const mockRefresh = jest.fn();

jest.mock("expo-router", () => ({
  router: { back: jest.fn(), navigate: jest.fn() },
  useLocalSearchParams: () => mockSearchParams,
}));

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: mockIsOnline }),
}));

const mockTrip = {
  id: "trip-1",
  destination: "Paris",
  startsAt: new Date("2030-10-01T12:00:00.000Z"),
  endsAt: new Date("2030-10-05T12:00:00.000Z"),
  ownerName: "Ana",
  createdAt: new Date("2030-09-01T12:00:00.000Z"),
  updatedAt: new Date("2030-09-01T12:00:00.000Z"),
};

jest.mock("@/hooks/useTrip", () => ({
  useTrip: () => ({
    trip: mockTrip,
    status: "ready",
    refresh: mockRefresh,
  }),
}));

jest.mock("@/hooks/useTripScreenSync", () => ({
  useTripScreenSync: jest.fn(),
}));

jest.mock("@/services/mutation-service", () => ({
  mutationService: { updateTrip: jest.fn() },
}));

jest.mock("@/server/participants-server", () => ({
  participantsServer: { confirmTripByParticipantId: jest.fn() },
}));

jest.mock("@/app/(app)/trip/activities", () => ({
  Activities: () => null,
}));

jest.mock("@/app/(app)/trip/details", () => ({
  Details: () => null,
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("@/components/calendar", () => ({
  Calendar: () => null,
}));

jest.mock("@/utils/calendarUtils", () => ({
  calendarUtils: {
    createFromInterval: (startsAt: unknown, endsAt: unknown) => ({
      startsAt,
      endsAt,
      formatDatesInText: "1 a 5 de outubro",
      dates: {},
    }),
    orderStartsAtAndEndsAt: jest.fn(),
  },
}));

jest.mock("@/components/modal", () => {
  const { Text, View } = require("react-native");

  return {
    Modal: ({ visible, title, children }: any) =>
      visible ? (
        <View>
          <Text>{title}</Text>
          {children}
        </View>
      ) : null,
  };
});

jest.mock("@/components/input", () => {
  const { TextInput, View } = require("react-native");

  const Input = ({ children }: any) => <View>{children}</View>;
  Input.Field = (props: any) => <TextInput {...props} />;

  return { Input };
});

jest.mock("@/components/button", () => {
  const { TouchableOpacity, Text } = require("react-native");

  const Button = ({ children, onPress }: any) => (
    <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
  );
  Button.Title = ({ children }: any) => <Text>{children}</Text>;

  return { Button };
});

function openUpdateForm() {
  render(<Trip />, { wrapper: ToastProvider });
  fireEvent.press(screen.getByLabelText("Editar viagem"));
}

describe("Trip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockSearchParams = { id: "trip-1" };
    jest.spyOn(Alert, "alert");
  });

  it("should show an error when updating the trip fails", async () => {
    (mutationService.updateTrip as jest.Mock).mockRejectedValue(
      new Error("SQLITE_BUSY"),
    );

    openUpdateForm();
    fireEvent.press(screen.getByText("Atualizar"));

    expect(
      await screen.findByText("Não foi possível atualizar a viagem."),
    ).toBeTruthy();
    expect(screen.getByText("Atualizar viagem")).toBeTruthy();
  });

  it("should show a validation error when the destination is empty", async () => {
    openUpdateForm();
    fireEvent.changeText(screen.getByPlaceholderText("Para onde?"), "");
    fireEvent.press(screen.getByText("Atualizar"));

    expect(
      await screen.findByText(
        "Preencha o destino e selecione as datas de início e fim da viagem.",
      ),
    ).toBeTruthy();
    expect(mutationService.updateTrip).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show a success toast and close the form when online", async () => {
    (mutationService.updateTrip as jest.Mock).mockResolvedValue(undefined);

    openUpdateForm();
    fireEvent.press(screen.getByText("Atualizar"));

    expect(await screen.findByText("Viagem atualizada com sucesso!")).toBeTruthy();
    expect(screen.queryByText("Atualizar viagem")).toBeNull();
    expect(mockRefresh).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show an offline info toast when updating offline", async () => {
    mockIsOnline = false;
    (mutationService.updateTrip as jest.Mock).mockResolvedValue(undefined);

    openUpdateForm();
    fireEvent.press(screen.getByText("Atualizar"));

    expect(
      await screen.findByText(
        "Alterações salvas offline. Serão sincronizadas quando houver conexão.",
      ),
    ).toBeTruthy();
  });

  it("should still ask for confirmation before removing the trip", () => {
    openUpdateForm();
    fireEvent.press(screen.getByText("Remover viagem"));

    expect(Alert.alert).toHaveBeenCalledWith(
      "Remover viagem",
      expect.any(String),
      expect.any(Array),
    );
  });

  it("should show the api message when confirming attendance fails", async () => {
    mockSearchParams = { id: "trip-1", participants: "participant-1" };
    (participantsServer.confirmTripByParticipantId as jest.Mock).mockRejectedValue(
      new AppError("Convite expirado.", { status: 410 }),
    );

    render(<Trip />, { wrapper: ToastProvider });

    fireEvent.changeText(screen.getByPlaceholderText("Seu nome completo"), "Ana");
    fireEvent.changeText(
      screen.getByPlaceholderText("E-mail de confirmação"),
      "ana@mail.com",
    );
    fireEvent.press(screen.getByText("Confirmar minha presença"));

    expect(await screen.findByText("Convite expirado.")).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
