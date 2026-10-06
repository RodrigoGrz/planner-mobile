import { fireEvent, render, screen } from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Alert, AlertButton } from "react-native";

import Create from "@/app/(app)/trip/create";
import { ToastProvider } from "@/contexts/ToastContext";
import { mutationService } from "@/services/mutation-service";
import { syncTripWithCalendar } from "@/utils/toggle/calendar-sync";

let mockIsOnline = true;

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { name: "Ana" } }),
}));

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: mockIsOnline }),
}));

jest.mock("@/services/mutation-service", () => ({
  mutationService: { createTrip: jest.fn() },
}));

jest.mock("@/utils/toggle/calendar-permission", () => ({
  calendarPermission: jest.fn(() => Promise.resolve(true)),
}));

jest.mock("@/utils/toggle/calendar-sync", () => ({
  syncTripWithCalendar: jest.fn(),
}));

jest.mock("@/utils/calendarUtils", () => ({
  calendarUtils: {
    orderStartsAtAndEndsAt: () => ({
      startsAt: { dateString: "2030-10-01" },
      endsAt: { dateString: "2030-10-05" },
      formatDatesInText: "1 a 5 de outubro",
      dates: {},
    }),
  },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

let mockCalendarProps: Record<string, unknown> = {};

jest.mock("@/components/calendar", () => {
  const { Text, TouchableOpacity } = require("react-native");

  return {
    Calendar: (props: any) => {
      mockCalendarProps = props;

      return (
        <TouchableOpacity
          onPress={() => props.onDayPress({ dateString: "2030-10-01" })}
        >
          <Text>pick-day</Text>
        </TouchableOpacity>
      );
    },
  };
});

jest.mock("@/components/email", () => ({
  GuestEmail: () => null,
}));

jest.mock("@/components/toggle", () => {
  const { Text, TouchableOpacity } = require("react-native");

  const Toggle = ({ children, onChange }: any) => (
    <TouchableOpacity onPress={onChange}>{children}</TouchableOpacity>
  );
  Toggle.Label = ({ children }: any) => <Text>{children}</Text>;

  return { Toggle };
});

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

function confirmAlertsAutomatically() {
  jest
    .spyOn(Alert, "alert")
    .mockImplementation((_title, _message, buttons?: AlertButton[]) => {
      buttons?.find((button) => button.text === "Sim")?.onPress?.();
    });
}

function fillTripDetails() {
  fireEvent.changeText(screen.getByPlaceholderText("Para onde?"), "Paris");
  fireEvent(screen.getByPlaceholderText("Quando?"), "pressIn");
  fireEvent.press(screen.getByText("pick-day"));
  fireEvent.press(screen.getByText("Confirmar"));
}

function submitNewTrip() {
  render(<Create />, { wrapper: ToastProvider });

  fillTripDetails();
  fireEvent.press(screen.getByText("Continuar"));
  fireEvent.press(screen.getByText("Confirmar Viagem"));
}

describe("Create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    confirmAlertsAutomatically();
    (mutationService.createTrip as jest.Mock).mockResolvedValue({
      localId: "trip-local-1",
    });
  });

  it("should still ask for confirmation before creating the trip", async () => {
    submitNewTrip();

    expect(Alert.alert).toHaveBeenCalledWith(
      "Nova viagem",
      "Confirmar viagem?",
      expect.any(Array),
    );
    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
  });

  it("should create the trip with the selected calendar days", async () => {
    submitNewTrip();

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(mutationService.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({
        startsAt: "2030-10-01",
        endsAt: "2030-10-05",
      }),
    );
  });

  it("should allow today as the first day late at night", () => {
    jest.useFakeTimers({ now: new Date(2026, 9, 1, 22, 0, 0) });

    render(<Create />, { wrapper: ToastProvider });
    fireEvent(screen.getByPlaceholderText("Quando?"), "pressIn");

    expect(mockCalendarProps.minDate).toBe("2026-10-01");
    jest.useRealTimers();
  });

  it("should show an error when creating the trip fails", async () => {
    (mutationService.createTrip as jest.Mock).mockRejectedValue(
      new Error("SQLITE_BUSY"),
    );

    submitNewTrip();

    expect(
      await screen.findByText("Não foi possível criar a viagem."),
    ).toBeTruthy();
    expect(router.navigate).not.toHaveBeenCalled();
  });

  it("should show a validation error when the trip details are missing", async () => {
    render(<Create />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Continuar"));

    expect(
      await screen.findByText(
        "Preencha todas as informações da viagem para seguir.",
      ),
    ).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show a success toast and open the trip when online", async () => {
    submitNewTrip();

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith("/trip/trip-local-1");
  });

  it("should show an offline info toast and open the trip when offline", async () => {
    mockIsOnline = false;

    submitNewTrip();

    expect(
      await screen.findByText(
        "Viagem salva offline. Será sincronizada quando houver conexão.",
      ),
    ).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith("/trip/trip-local-1");
  });

  it("should warn when the trip is created but the calendar sync fails", async () => {
    (syncTripWithCalendar as jest.Mock).mockRejectedValue(new Error("denied"));

    render(<Create />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Sincronizar com o calendário"));
    await screen.findByText("Sincronizar com o calendário");

    fillTripDetails();
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent.press(screen.getByText("Confirmar Viagem"));

    expect(
      await screen.findByText(
        "Viagem criada, mas não foi possível sincronizar com o calendário.",
      ),
    ).toBeTruthy();
    expect(router.navigate).toHaveBeenCalledWith("/trip/trip-local-1");
  });

  it("should show an invalid email error when inviting a guest", async () => {
    render(<Create />, { wrapper: ToastProvider });

    fillTripDetails();
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent(screen.getByPlaceholderText("Quem estará na viagem?"), "pressIn");
    fireEvent.changeText(
      screen.getByPlaceholderText("Digite o e-mail do convidado"),
      "not-an-email",
    );
    fireEvent.press(screen.getByText("Convidar"));

    expect(await screen.findByText("E-mail inválido.")).toBeTruthy();
  });

  it("should show an info toast when no image is selected", async () => {
    (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
      canceled: true,
      assets: null,
    });

    render(<Create />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Imagem do lugar"));

    expect(await screen.findByText("Nenhuma imagem selecionada.")).toBeTruthy();
  });
});
