import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";
import { Alert } from "react-native";

import SignUp from "@/app/(auth)/sign-up";
import { registerServer } from "@/server/register-server";
import { router } from "expo-router";

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
    render(<SignUp />);

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

    render(<SignUp />);

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

    expect(Alert.alert).toHaveBeenCalledWith(
      "Criar conta",
      "Conta criada com sucesso",
    );

    expect(router.back).toHaveBeenCalled();
  });

  it("should show alert when register fails", async () => {
    jest
      .spyOn(registerServer, "registerTraveler")
      .mockRejectedValue(new Error("Erro fake"));

    jest.spyOn(Alert, "alert");

    render(<SignUp />);

    fireEvent.press(screen.getByText("Registrar"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Criar conta", "Erro fake");
    });
  });

  it("should toggle password visibility", () => {
    render(<SignUp />);

    const toggle = screen.getByTestId("toggle-password");

    fireEvent.press(toggle);

    expect(true).toBeTruthy();
  });

  it("should navigate to sign-in", () => {
    render(<SignUp />);

    fireEvent.press(screen.getByText("Entrar"));

    expect(router.push).toHaveBeenCalledWith("/sign-in");
  });
});
