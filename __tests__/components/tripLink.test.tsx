import { TripLink } from "@/components/tripLink";
import { ToastProvider } from "@/contexts/ToastContext";
import { fireEvent, render, screen } from "@testing-library/react-native";
import * as Linking from "expo-linking";
import { Alert } from "react-native";

jest.mock("expo-linking", () => ({
  openURL: jest.fn(),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

function renderLink(url: string) {
  render(<TripLink data={{ id: "link-1", title: "Reserva", url }} />, {
    wrapper: ToastProvider,
  });

  fireEvent.press(screen.getByLabelText("Abrir link"));
}

describe("TripLink", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Alert, "alert");
  });

  it("should open safe links", () => {
    renderLink("https://example.com/reserva");

    expect(Linking.openURL).toHaveBeenCalledWith("https://example.com/reserva");
  });

  it("should show an error toast for unsafe links", async () => {
    renderLink("javascript:alert(1)");

    expect(
      await screen.findByText("Este link não pode ser aberto com segurança."),
    ).toBeTruthy();
    expect(Linking.openURL).not.toHaveBeenCalled();
    expect(Alert.alert).not.toHaveBeenCalled();
  });
});
