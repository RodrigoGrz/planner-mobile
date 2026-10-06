import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { Activities } from "@/app/(app)/trip/activities";
import { ToastProvider } from "@/contexts/ToastContext";
import { mutationService } from "@/services/mutation-service";

let mockIsOnline = true;
const mockRefresh = jest.fn();

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: mockIsOnline }),
}));

jest.mock("@/hooks/useActivities", () => ({
  useActivities: () => ({
    sections: [],
    status: "ready",
    refresh: mockRefresh,
  }),
}));

jest.mock("@/services/mutation-service", () => ({
  mutationService: { createActivity: jest.fn() },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
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
          onPress={() => props.onDayPress({ dateString: "2026-10-02" })}
        >
          <Text>pick-day</Text>
        </TouchableOpacity>
      );
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

const tripDetails = {
  id: "trip-1",
  destination: "Paris",
  startsAt: new Date("2026-10-01T00:00:00.000Z"),
  endsAt: new Date("2026-10-05T00:00:00.000Z"),
  ownerName: "Ana",
  createdAt: new Date("2026-09-01T00:00:00.000Z"),
  updatedAt: new Date("2026-09-01T00:00:00.000Z"),
  when: "Paris de 01 a 05 de out.",
};

function submitNewActivity({
  filled,
  hour = "14",
}: {
  filled: boolean;
  hour?: string;
}) {
  render(<Activities tripDetails={tripDetails} />, { wrapper: ToastProvider });

  fireEvent.press(screen.getByText("Nova atividade"));

  if (filled) {
    fireEvent.changeText(screen.getByPlaceholderText("Qual atividade?"), "Museu");
    fireEvent(screen.getByPlaceholderText("Data"), "pressIn");
    fireEvent.press(screen.getByText("pick-day"));
    fireEvent.press(screen.getByText("Confirmar"));
    fireEvent.changeText(screen.getByPlaceholderText("Horário?"), hour);
  }

  fireEvent.press(screen.getByText("Salvar atividade"));
}

describe("Activities", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    jest.spyOn(Alert, "alert");
  });

  it("should show an error when saving the activity fails", async () => {
    (mutationService.createActivity as jest.Mock).mockRejectedValue(
      new Error("SQLITE_BUSY"),
    );

    submitNewActivity({ filled: true });

    expect(
      await screen.findByText("Não foi possível salvar a atividade."),
    ).toBeTruthy();
    expect(screen.getByText("Cadastrar atividade")).toBeTruthy();
  });

  it("should show a validation error when fields are missing", async () => {
    submitNewActivity({ filled: false });

    expect(await screen.findByText("Preencha todos os campos.")).toBeTruthy();
    expect(mutationService.createActivity).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show a success toast and close the form when online", async () => {
    (mutationService.createActivity as jest.Mock).mockResolvedValue({});

    submitNewActivity({ filled: true });

    expect(
      await screen.findByText("Nova atividade cadastrada com sucesso!"),
    ).toBeTruthy();
    expect(screen.queryByText("Cadastrar atividade")).toBeNull();
    expect(mockRefresh).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should create the activity with the selected day and hour", async () => {
    (mutationService.createActivity as jest.Mock).mockResolvedValue({});

    submitNewActivity({ filled: true, hour: "22" });

    expect(
      await screen.findByText("Nova atividade cadastrada com sucesso!"),
    ).toBeTruthy();
    expect(mutationService.createActivity).toHaveBeenCalledWith({
      tripId: "trip-1",
      title: "Museu",
      date: "2026-10-02",
      hour: 22,
    });
  });

  it("should show an error for an hour outside 0 to 23", async () => {
    submitNewActivity({ filled: true, hour: "25" });

    expect(
      await screen.findByText("Informe um horário entre 0 e 23."),
    ).toBeTruthy();
    expect(mutationService.createActivity).not.toHaveBeenCalled();
  });

  it("should limit the activity calendar to the trip days", () => {
    render(<Activities tripDetails={tripDetails} />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Nova atividade"));
    fireEvent(screen.getByPlaceholderText("Data"), "pressIn");

    expect(mockCalendarProps).toMatchObject({
      initialDate: "2026-10-01",
      minDate: "2026-10-01",
      maxDate: "2026-10-05",
    });
  });

  it("should show an offline info toast when saving offline", async () => {
    mockIsOnline = false;
    (mutationService.createActivity as jest.Mock).mockResolvedValue({});

    submitNewActivity({ filled: true });

    expect(
      await screen.findByText(
        "Atividade salva offline. Será sincronizada quando houver conexão.",
      ),
    ).toBeTruthy();
  });
});
