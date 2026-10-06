import {
  act,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";
import * as ImagePicker from "expo-image-picker";
import { router } from "expo-router";
import { Alert, AlertButton } from "react-native";

import Create from "@/app/(app)/trip/create";
import { ToastProvider } from "@/contexts/ToastContext";
import { mutationService } from "@/services/mutation-service";
import { prepareCoverImage } from "@/utils/prepare-cover-image";
import { syncTripWithCalendar } from "@/utils/toggle/calendar-sync";

let mockIsOnline = true;

jest.mock("expo-router", () => ({
  router: { navigate: jest.fn() },
}));

jest.mock("expo-image-picker", () => ({
  launchImageLibraryAsync: jest.fn(),
}));

jest.mock("@/utils/prepare-cover-image", () => ({
  prepareCoverImage: jest.fn(),
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

let mockPeriod = { startsAt: "2030-10-01", endsAt: "2030-10-05" };

jest.mock("@/utils/calendarUtils", () => ({
  calendarUtils: {
    orderStartsAtAndEndsAt: () => ({
      startsAt: { dateString: mockPeriod.startsAt },
      endsAt: { dateString: mockPeriod.endsAt },
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

function fillTripDetails(destination = "Paris") {
  fireEvent.changeText(screen.getByPlaceholderText("Para onde?"), destination);
  fireEvent(screen.getByPlaceholderText("Quando?"), "pressIn");
  fireEvent.press(screen.getByText("pick-day"));
  fireEvent.press(screen.getByText("Confirmar"));
}

function submitNewTrip(destination = "Paris") {
  render(<Create />, { wrapper: ToastProvider });

  fillTripDetails(destination);
  fireEvent.press(screen.getByText("Continuar"));
  fireEvent.press(screen.getByText("Confirmar Viagem"));
}

function openInviteModal() {
  render(<Create />, { wrapper: ToastProvider });

  fillTripDetails();
  fireEvent.press(screen.getByText("Continuar"));
  fireEvent(screen.getByPlaceholderText("Quem estará na viagem?"), "pressIn");
}

function inviteGuest(email: string) {
  fireEvent.changeText(
    screen.getByPlaceholderText("Digite o e-mail do convidado"),
    email,
  );
  fireEvent.press(screen.getByText("Convidar"));
}

describe("Create", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockIsOnline = true;
    mockPeriod = { startsAt: "2030-10-01", endsAt: "2030-10-05" };
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

  it("should reject a destination shorter than 3 characters", async () => {
    render(<Create />, { wrapper: ToastProvider });

    fillTripDetails("Ri");
    fireEvent.press(screen.getByText("Continuar"));

    expect(
      await screen.findByText("O destino deve ter entre 3 e 100 caracteres."),
    ).toBeTruthy();
    expect(screen.queryByText("Confirmar Viagem")).toBeNull();
  });

  it("should accept a destination with 3 characters", async () => {
    submitNewTrip("Rio");

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(mutationService.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Rio" }),
    );
  });

  it("should send the trimmed destination", async () => {
    submitNewTrip("  Paris  ");

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(mutationService.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Paris" }),
    );
  });

  it("should sync the trimmed destination with the device calendar", async () => {
    (syncTripWithCalendar as jest.Mock).mockResolvedValue(undefined);
    render(<Create />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Sincronizar com o calendário"));
    await screen.findByText("Sincronizar com o calendário");

    fillTripDetails("  Paris  ");
    fireEvent.press(screen.getByText("Continuar"));
    fireEvent.press(screen.getByText("Confirmar Viagem"));

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(syncTripWithCalendar).toHaveBeenCalledWith(
      expect.objectContaining({ destination: "Paris" }),
    );
  });

  it("should limit the destination input to 100 characters", () => {
    render(<Create />, { wrapper: ToastProvider });

    expect(screen.getByPlaceholderText("Para onde?").props.maxLength).toBe(100);
  });

  it("should reject a trip longer than 30 days", async () => {
    mockPeriod = { startsAt: "2030-10-01", endsAt: "2030-11-01" };
    render(<Create />, { wrapper: ToastProvider });

    fillTripDetails();
    fireEvent.press(screen.getByText("Continuar"));

    expect(
      await screen.findByText("A viagem pode ter no máximo 30 dias."),
    ).toBeTruthy();
    expect(screen.queryByText("Confirmar Viagem")).toBeNull();
  });

  it("should invite the normalized e-mail", async () => {
    openInviteModal();
    inviteGuest(" Ana@Example.com ");
    fireEvent.press(screen.getByText("Confirmar Viagem"));

    expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
    expect(mutationService.createTrip).toHaveBeenCalledWith(
      expect.objectContaining({ emailsToInvite: ["ana@example.com"] }),
    );
  });

  it("should treat invite e-mails with different case and spaces as duplicates", async () => {
    openInviteModal();
    inviteGuest("ana@example.com");
    inviteGuest("  ANA@Example.com ");

    expect(await screen.findByText("E-mail já foi adicionado.")).toBeTruthy();
  });

  it("should not allow more than 20 invites", async () => {
    openInviteModal();

    for (let index = 1; index <= 20; index += 1) {
      inviteGuest(`guest${index}@example.com`);
    }
    inviteGuest("guest21@example.com");

    expect(
      await screen.findByText("Você pode convidar até 20 pessoas por viagem."),
    ).toBeTruthy();
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

  describe("cover image", () => {
    const pickedPhoto = {
      uri: "file:///cache/photo.heic",
      width: 4032,
      height: 3024,
    };

    beforeEach(() => {
      (ImagePicker.launchImageLibraryAsync as jest.Mock).mockResolvedValue({
        canceled: false,
        assets: [pickedPhoto],
      });
    });

    async function pickCoverAndCreateTrip() {
      render(<Create />, { wrapper: ToastProvider });

      fireEvent.press(screen.getByText("Imagem do lugar"));
      await waitFor(() => {
        expect(prepareCoverImage).toHaveBeenCalled();
      });

      fillTripDetails();
      fireEvent.press(screen.getByText("Continuar"));
      fireEvent.press(screen.getByText("Confirmar Viagem"));
    }

    it("should create the trip with the converted cover image", async () => {
      (prepareCoverImage as jest.Mock).mockResolvedValue(
        "file:///cache/converted.jpg",
      );

      await pickCoverAndCreateTrip();

      expect(await screen.findByText("Viagem criada com sucesso!")).toBeTruthy();
      expect(prepareCoverImage).toHaveBeenCalledWith(pickedPhoto);
      expect(mutationService.createTrip).toHaveBeenCalledWith(
        expect.objectContaining({ coverImageUri: "file:///cache/converted.jpg" }),
      );
    });

    function deferCoverPreparation() {
      let finish: (uri: string) => void = () => {};
      (prepareCoverImage as jest.Mock).mockReturnValue(
        new Promise<string>((resolve) => {
          finish = resolve;
        }),
      );

      return (uri: string) => finish(uri);
    }

    it("should show the cover image as preparing until the conversion finishes", async () => {
      const finishPreparation = deferCoverPreparation();
      render(<Create />, { wrapper: ToastProvider });

      fireEvent.press(screen.getByText("Imagem do lugar"));

      expect(await screen.findByText("Preparando imagem...")).toBeTruthy();

      await act(async () => {
        finishPreparation("file:///cache/converted.jpg");
      });

      expect(await screen.findByText("Alterar imagem")).toBeTruthy();
      expect(screen.queryByText("Preparando imagem...")).toBeNull();
    });

    it("should not continue while the cover image is being prepared", async () => {
      deferCoverPreparation();
      render(<Create />, { wrapper: ToastProvider });

      fireEvent.press(screen.getByText("Imagem do lugar"));
      await screen.findByText("Preparando imagem...");

      fillTripDetails();
      fireEvent.press(screen.getByText("Continuar"));

      expect(await screen.findByText("Aguarde a imagem ficar pronta.")).toBeTruthy();
      expect(screen.queryByText("Confirmar Viagem")).toBeNull();
    });

    it("should not open the picker again while the cover image is being prepared", async () => {
      deferCoverPreparation();
      render(<Create />, { wrapper: ToastProvider });

      fireEvent.press(screen.getByText("Imagem do lugar"));
      fireEvent.press(await screen.findByText("Preparando imagem..."));

      expect(ImagePicker.launchImageLibraryAsync).toHaveBeenCalledTimes(1);
    });

    it("should keep no cover and warn when the image cannot be prepared", async () => {
      (prepareCoverImage as jest.Mock).mockRejectedValue(new Error("decode failed"));

      await pickCoverAndCreateTrip();

      expect(
        await screen.findByText("Não foi possível preparar a imagem."),
      ).toBeTruthy();
      await waitFor(() => {
        expect(mutationService.createTrip).toHaveBeenCalledWith(
          expect.objectContaining({ coverImageUri: null }),
        );
      });
    });
  });
});
