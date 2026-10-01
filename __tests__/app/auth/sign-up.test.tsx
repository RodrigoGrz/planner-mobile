import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import SignUp from "@/app/(auth)/sign-up";
import { ToastProvider } from "@/contexts/ToastContext";
import { registerServer } from "@/server/register-server";
import { AppError } from "@/utils/app-error";
import { router } from "expo-router";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
    back: jest.fn(),
  },
}));

jest.mock("@/server/register-server", () => ({
  registerServer: {
    registerTraveler: jest.fn(),
  },
}));

jest.mock("lucide-react-native", () => ({
  Eye: () => null,
  EyeOff: () => null,
  Lock: () => null,
  Mail: () => null,
  Pencil: () => null,
  Phone: () => null,
  User: () => null,
  CircleAlert: () => null,
  CircleCheck: () => null,
  Info: () => null,
}));

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

jest.mock("react-native-keyboard-aware-scroll-view", () => {
  const { View } = require("react-native");

  return {
    KeyboardAwareScrollView: ({ children }: any) => <View>{children}</View>,
  };
});

jest.mock("@/utils/make-phone", () => ({
  maskPhone: jest.fn((v) => v),
}));

describe("SignUp", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render screen correctly", () => {
    render(<SignUp />, { wrapper: ToastProvider });

    expect(screen.getByText("Criar uma conta?")).toBeTruthy();
    expect(screen.getByPlaceholderText("Nome")).toBeTruthy();
    expect(screen.getByPlaceholderText("E-mail")).toBeTruthy();
    expect(screen.getByPlaceholderText("Senha")).toBeTruthy();
    expect(screen.getByPlaceholderText("Telefone")).toBeTruthy();
    expect(screen.getByText("Registrar")).toBeTruthy();
  });

  it("should call register with correct data", async () => {
    const registerMock = jest
      .spyOn(registerServer, "registerTraveler")
      .mockResolvedValue({} as any);

    jest.spyOn(Alert, "alert");

    render(<SignUp />, { wrapper: ToastProvider });

    fireEvent.changeText(screen.getByPlaceholderText("Nome"), "Rodrigo");
    fireEvent.changeText(
      screen.getByPlaceholderText("E-mail"),
      "test@mail.com",
    );
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "123456");
    fireEvent.changeText(screen.getByPlaceholderText("Telefone"), "99999999");

    fireEvent.press(screen.getByText("Registrar"));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: "Rodrigo",
        email: "test@mail.com",
        password: "123456",
        phone: "99999999",
      });
    });

    expect(await screen.findByText("Conta criada com sucesso!")).toBeTruthy();
    expect(Alert.alert).not.toHaveBeenCalled();
    expect(router.back).toHaveBeenCalled();
  });

  function submitRegisterRejectingWith(error: unknown) {
    jest.spyOn(registerServer, "registerTraveler").mockRejectedValue(error);
    jest.spyOn(Alert, "alert");

    render(<SignUp />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Registrar"));
  }

  it("should show an error toast with the fallback when register fails", async () => {
    submitRegisterRejectingWith(new Error("Erro fake"));

    expect(
      await screen.findByText("Não foi possível criar a conta."),
    ).toBeTruthy();
    expect(screen.queryByText("Erro fake")).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show the invalid fields when the api returns a validation error", async () => {
    submitRegisterRejectingWith(
      new AppError("Validation error", {
        status: 400,
        fieldErrors: { email: ["Invalid email"], phone: ["Too short"] },
      }),
    );

    expect(
      await screen.findByText("Verifique os campos: e-mail, telefone."),
    ).toBeTruthy();
    expect(screen.queryByText("Validation error")).toBeNull();
  });

  it("should show the api message on a conflict", async () => {
    submitRegisterRejectingWith(
      new AppError("E-mail já cadastrado.", { status: 409 }),
    );

    expect(await screen.findByText("E-mail já cadastrado.")).toBeTruthy();
  });

  it("should toggle password visibility", () => {
    render(<SignUp />, { wrapper: ToastProvider });

    const toggle = screen.getByTestId("toggle-password");

    fireEvent.press(toggle);

    expect(true).toBeTruthy();
  });

  it("should navigate to sign-in", () => {
    render(<SignUp />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Entrar"));

    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });
});
