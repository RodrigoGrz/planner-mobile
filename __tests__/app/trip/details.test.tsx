import { fireEvent, render, screen } from "@testing-library/react-native";
import { Alert } from "react-native";

import { Details } from "@/app/(app)/trip/details";
import { ToastProvider } from "@/contexts/ToastContext";
import { mutationService } from "@/services/mutation-service";

let mockIsOnline = true;
const mockRefresh = jest.fn();

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({ isOnline: mockIsOnline }),
}));

jest.mock("@/hooks/useTripDetails", () => ({
  useTripDetails: () => ({
    links: [],
    participants: [],
    status: "ready",
    refresh: mockRefresh,
  }),
}));

jest.mock("@/services/mutation-service", () => ({
  mutationService: { createLink: jest.fn() },
}));

jest.mock("@/utils/logger", () => ({
  logger: { debug: jest.fn(), warn: jest.fn(), error: jest.fn() },
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

jest.mock("expo-linking", () => ({
  canOpenURL: jest.fn(),
  openURL: jest.fn(),
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

function openNewLinkForm({ title, url }: { title: string; url: string }) {
  render(<Details tripId="trip-1" />, { wrapper: ToastProvider });

  fireEvent.press(screen.getByText("Cadastrar novo link"));
  fireEvent.changeText(screen.getByPlaceholderText("Título do link"), title);
  fireEvent.changeText(screen.getByPlaceholderText("URL"), url);
  fireEvent.press(screen.getByText("Salvar Link"));
}

describe("Details", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    jest.spyOn(Alert, "alert");
  });

  it("should show an error when saving the link fails", async () => {
    (mutationService.createLink as jest.Mock).mockRejectedValue(
      new Error("SQLITE_BUSY"),
    );

    openNewLinkForm({ title: "Reserva", url: "https://example.com" });

    expect(
      await screen.findByText("Não foi possível salvar o link."),
    ).toBeTruthy();
    expect(screen.getByText("Cadastrar link")).toBeTruthy();
  });

  it("should show a validation error when the title is empty", async () => {
    openNewLinkForm({ title: " ", url: "https://example.com" });

    expect(
      await screen.findByText("Informe um título para o link."),
    ).toBeTruthy();
    expect(mutationService.createLink).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show a validation error when the url is invalid", async () => {
    openNewLinkForm({ title: "Reserva", url: "not a url" });

    expect(
      await screen.findByText("Link inválido. Use um endereço http ou https."),
    ).toBeTruthy();
    expect(mutationService.createLink).not.toHaveBeenCalled();
  });

  it("should reject a javascript link", async () => {
    openNewLinkForm({ title: "Reserva", url: "javascript:alert(1)" });

    expect(
      await screen.findByText("Link inválido. Use um endereço http ou https."),
    ).toBeTruthy();
    expect(mutationService.createLink).not.toHaveBeenCalled();
  });

  it("should reject a link title longer than 100 characters", async () => {
    openNewLinkForm({ title: "a".repeat(101), url: "https://example.com" });

    expect(
      await screen.findByText("O título deve ter no máximo 100 caracteres."),
    ).toBeTruthy();
    expect(mutationService.createLink).not.toHaveBeenCalled();
  });

  it("should send the trimmed link title and url", async () => {
    (mutationService.createLink as jest.Mock).mockResolvedValue({});

    openNewLinkForm({ title: "  Reserva  ", url: " https://example.com/reserva " });

    expect(await screen.findByText("Link criado com sucesso!")).toBeTruthy();
    expect(mutationService.createLink).toHaveBeenCalledWith({
      tripId: "trip-1",
      title: "Reserva",
      url: "https://example.com/reserva",
    });
  });

  it("should limit the link inputs to the api sizes", () => {
    render(<Details tripId="trip-1" />, { wrapper: ToastProvider });
    fireEvent.press(screen.getByText("Cadastrar novo link"));

    expect(screen.getByPlaceholderText("Título do link").props.maxLength).toBe(100);
    expect(screen.getByPlaceholderText("URL").props.maxLength).toBe(2048);
  });

  it("should show a success toast and close the form when online", async () => {
    (mutationService.createLink as jest.Mock).mockResolvedValue({});

    openNewLinkForm({ title: "Reserva", url: "https://example.com" });

    expect(await screen.findByText("Link criado com sucesso!")).toBeTruthy();
    expect(screen.queryByText("Cadastrar link")).toBeNull();
    expect(mockRefresh).toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show an offline info toast when saving offline", async () => {
    mockIsOnline = false;
    (mutationService.createLink as jest.Mock).mockResolvedValue({});

    openNewLinkForm({ title: "Reserva", url: "https://example.com" });

    expect(
      await screen.findByText(
        "Link salvo offline. Será sincronizado quando houver conexão.",
      ),
    ).toBeTruthy();
  });
});
