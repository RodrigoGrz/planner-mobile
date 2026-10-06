import { fireEvent, render, screen } from "@testing-library/react-native";
import { router } from "expo-router";
import { Alert } from "react-native";

import Trip from "@/app/(app)/trip/[id]";
import { ToastProvider } from "@/contexts/ToastContext";
import { mutationService } from "@/services/mutation-service";
import "@/utils/dayjsLocaleConfig";

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
  startsAt: new Date("2030-10-01T00:00:00.000Z"),
  endsAt: new Date("2030-10-05T00:00:00.000Z"),
  ownerName: "Ana",
  createdAt: new Date("2030-09-01T12:00:00.000Z"),
  updatedAt: new Date("2030-09-01T12:00:00.000Z"),
};

let mockIsRemoved = false;
let mockIsInvitePending = false;

jest.mock("@/hooks/useTrip", () => ({
  useTrip: () => ({
    trip: mockIsRemoved ? null : mockTrip,
    status: "ready",
    refresh: mockRefresh,
    isRemoved: mockIsRemoved,
    isInvitePending: mockIsInvitePending,
  }),
}));

jest.mock("@/hooks/useTripScreenSync", () => ({
  useTripScreenSync: jest.fn(),
}));

jest.mock("@/services/mutation-service", () => ({
  mutationService: { updateTrip: jest.fn() },
}));

jest.mock("@/app/(app)/trip/activities", () => {
  const { Text } = require("react-native");

  return { Activities: () => <Text>activities-tab</Text> };
});

jest.mock("@/app/(app)/trip/details", () => {
  const { Text } = require("react-native");

  return { Details: () => <Text>details-tab</Text> };
});

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

jest.mock("@/utils/calendarUtils", () => {
  const { toTripDayString } = jest.requireActual("@/utils/trip-dates");

  return {
    calendarUtils: {
      createFromInterval: (startsAt: unknown, endsAt: unknown) => ({
        startsAt,
        endsAt,
        formatDatesInText: "1 a 5 de outubro",
        dates: {},
      }),
      orderStartsAtAndEndsAt: jest.fn(),
      toCalendarDate: (value: string | Date) => ({
        dateString: toTripDayString(value),
      }),
    },
  };
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

function openUpdateForm() {
  render(<Trip />, { wrapper: ToastProvider });
  fireEvent.press(screen.getByLabelText("Editar viagem"));
}

describe("Trip", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockIsRemoved = false;
    mockIsInvitePending = false;
    mockSearchParams = { id: "trip-1" };
    jest.spyOn(Alert, "alert");
  });

  it("should show the trip period without shifting the days", () => {
    render(<Trip />, { wrapper: ToastProvider });

    expect(screen.getByDisplayValue("Paris de 01 a 05 de out.")).toBeTruthy();
  });

  it("should update the trip with the selected calendar days", async () => {
    (mutationService.updateTrip as jest.Mock).mockResolvedValue(undefined);

    openUpdateForm();
    fireEvent.press(screen.getByText("Atualizar"));

    expect(await screen.findByText("Viagem atualizada com sucesso!")).toBeTruthy();
    expect(mutationService.updateTrip).toHaveBeenCalledWith({
      tripId: "trip-1",
      destination: "Paris",
      startsAt: "2030-10-01",
      endsAt: "2030-10-05",
    });
  });

  it("should navigate home when the trip is removed", () => {
    mockIsRemoved = true;

    render(<Trip />, { wrapper: ToastProvider });

    expect(router.navigate).toHaveBeenCalledWith("/");
  });

  it("should not navigate home while the trip exists", () => {
    render(<Trip />, { wrapper: ToastProvider });

    expect(router.navigate).not.toHaveBeenCalled();
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

  it("should show the pending invite notice instead of activities and details", () => {
    mockIsInvitePending = true;

    render(<Trip />, { wrapper: ToastProvider });

    expect(
      screen.getByText(
        "Confirme sua presença pelo link enviado ao seu e-mail para ver atividades, links e participantes.",
      ),
    ).toBeTruthy();
    expect(screen.getByDisplayValue("Paris de 01 a 05 de out.")).toBeTruthy();
    expect(screen.queryByText("activities-tab")).toBeNull();
    expect(screen.queryByText("details-tab")).toBeNull();
    expect(screen.queryByText("Atividades")).toBeNull();
    expect(screen.queryByText("Detalhes")).toBeNull();
  });

  it("should not allow editing a pending invite", () => {
    mockIsInvitePending = true;

    render(<Trip />, { wrapper: ToastProvider });

    expect(screen.queryByLabelText("Editar viagem")).toBeNull();
  });

  it("should show activities and details for a confirmed trip", () => {
    render(<Trip />, { wrapper: ToastProvider });

    expect(screen.getByText("activities-tab")).toBeTruthy();
    expect(screen.getByText("Atividades")).toBeTruthy();
    expect(screen.getByText("Detalhes")).toBeTruthy();
    expect(screen.getByLabelText("Editar viagem")).toBeTruthy();
    expect(
      screen.queryByText(
        "Confirme sua presença pelo link enviado ao seu e-mail para ver atividades, links e participantes.",
      ),
    ).toBeNull();
  });

  it("should not show the attendance confirmation for the legacy participants link", () => {
    mockSearchParams = { id: "trip-1", participants: "participant-1" };

    render(<Trip />, { wrapper: ToastProvider });

    expect(screen.queryByText("Confirmar presença")).toBeNull();
    expect(screen.queryByPlaceholderText("Seu nome completo")).toBeNull();
    expect(screen.queryByPlaceholderText("E-mail de confirmação")).toBeNull();
    expect(screen.getByDisplayValue("Paris de 01 a 05 de out.")).toBeTruthy();
  });
});
