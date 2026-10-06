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

function fillValidForm() {
  fireEvent.changeText(screen.getByPlaceholderText("Nome"), "Rodrigo");
  fireEvent.changeText(screen.getByPlaceholderText("E-mail"), "test@mail.com");
  fireEvent.changeText(screen.getByPlaceholderText("Senha"), "12345678");
  fireEvent.changeText(screen.getByPlaceholderText("Telefone"), "(67) 99999-9999");
}

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

    fillValidForm();

    fireEvent.press(screen.getByText("Registrar"));

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith({
        name: "Rodrigo",
        email: "test@mail.com",
        password: "12345678",
        phone: "(67) 99999-9999",
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

    fillValidForm();
    fireEvent.press(screen.getByText("Registrar"));
  }

  function submitForm(values: Partial<Record<"Nome" | "E-mail" | "Senha" | "Telefone", string>>) {
    const registerMock = jest
      .spyOn(registerServer, "registerTraveler")
      .mockResolvedValue({} as any);

    render(<SignUp />, { wrapper: ToastProvider });

    fillValidForm();
    for (const [placeholder, value] of Object.entries(values)) {
      fireEvent.changeText(screen.getByPlaceholderText(placeholder), value);
    }
    fireEvent.press(screen.getByText("Registrar"));

    return registerMock;
  }

  it("should not register with a password shorter than 8 characters", async () => {
    const registerMock = submitForm({ Senha: "1234567" });

    expect(
      await screen.findByText("A senha deve ter entre 8 caracteres e 72 bytes."),
    ).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("should not register with an invalid phone", async () => {
    const registerMock = submitForm({ Telefone: "99999999" });

    expect(
      await screen.findByText("Informe um telefone válido, com DDD."),
    ).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("should not register with a name shorter than 3 characters", async () => {
    const registerMock = submitForm({ Nome: "Ro" });

    expect(
      await screen.findByText("O nome deve ter entre 3 e 100 caracteres."),
    ).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("should not register with an invalid e-mail", async () => {
    const registerMock = submitForm({ "E-mail": "test@" });

    expect(await screen.findByText("E-mail inválido.")).toBeTruthy();
    expect(registerMock).not.toHaveBeenCalled();
  });

  it("should register with the trimmed name and normalized e-mail", async () => {
    const registerMock = submitForm({
      Nome: "  Rodrigo  ",
      "E-mail": "  Test@Mail.COM ",
    });

    await waitFor(() => {
      expect(registerMock).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Rodrigo", email: "test@mail.com" }),
      );
    });
  });

  it("should limit the inputs to the api sizes", () => {
    render(<SignUp />, { wrapper: ToastProvider });

    expect(screen.getByPlaceholderText("Nome").props.maxLength).toBe(100);
    expect(screen.getByPlaceholderText("E-mail").props.maxLength).toBe(254);
    expect(screen.getByPlaceholderText("Telefone").props.maxLength).toBe(20);
  });

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
