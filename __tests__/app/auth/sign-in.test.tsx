import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";

import SignIn from "@/app/(auth)/sign-in";
import { ToastProvider } from "@/contexts/ToastContext";
import { useAuth } from "@/hooks/useAuth";
import { AppError } from "@/utils/app-error";
import { router } from "expo-router";
import { Alert } from "react-native";

jest.mock("@/hooks/useAuth");

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("lucide-react-native", () => {
  const { Text } = require("react-native");

  return {
    Mail: () => <Text>MailIcon</Text>,
    Lock: () => <Text>LockIcon</Text>,
    Eye: () => <Text>EyeIcon</Text>,
    EyeOff: () => <Text>EyeOffIcon</Text>,
    Plane: () => <Text>PlaneIcon</Text>,
    CircleAlert: () => null,
    CircleCheck: () => null,
    Info: () => null,
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

jest.mock("react-native-keyboard-aware-scroll-view", () => {
  const { View } = require("react-native");

  return {
    KeyboardAwareScrollView: ({ children }: any) => <View>{children}</View>,
  };
});

const mockedUseAuth = useAuth as jest.Mock;
const mockedPush = router.push as jest.Mock;

describe("SignIn", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render screen correctly", () => {
    mockedUseAuth.mockReturnValue({
      signIn: jest.fn(),
    });

    render(<SignIn />, { wrapper: ToastProvider });

    expect(screen.getByText("Bem-vindo!")).toBeTruthy();
    expect(screen.getByPlaceholderText("E-mail")).toBeTruthy();
    expect(screen.getByPlaceholderText("Senha")).toBeTruthy();
    expect(screen.getByText("Entrar")).toBeTruthy();
  });

  it("should call signIn with email and password", async () => {
    const signInMock = jest.fn().mockResolvedValue({});

    mockedUseAuth.mockReturnValue({
      signIn: signInMock,
    });

    render(<SignIn />, { wrapper: ToastProvider });

    fireEvent.changeText(
      screen.getByPlaceholderText("E-mail"),
      "test@mail.com",
    );
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "123456");

    fireEvent.press(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(signInMock).toHaveBeenCalledWith("test@mail.com", "123456");
    });
  });

  function submitSignInRejectingWith(error: unknown) {
    jest.spyOn(Alert, "alert");

    mockedUseAuth.mockReturnValue({
      signIn: jest.fn().mockRejectedValue(error),
    });

    render(<SignIn />, { wrapper: ToastProvider });

    fireEvent.changeText(
      screen.getByPlaceholderText("E-mail"),
      "test@mail.com",
    );
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "123456");

    fireEvent.press(screen.getByText("Entrar"));
  }

  it("should show an error toast with the fallback when signIn fails", async () => {
    submitSignInRejectingWith(new Error("Erro fake"));

    expect(await screen.findByText("Não foi possível entrar.")).toBeTruthy();
    expect(screen.queryByText("Erro fake")).toBeNull();
    expect(Alert.alert).not.toHaveBeenCalled();
  });

  it("should show the api message when the credentials are wrong", async () => {
    submitSignInRejectingWith(
      new AppError("Credenciais incorretas.", { status: 401 }),
    );

    expect(await screen.findByText("Credenciais incorretas.")).toBeTruthy();
  });

  it("should show the network message when the server is unreachable", async () => {
    submitSignInRejectingWith(
      new AppError("Sem conexão com o servidor.", { code: "NETWORK" }),
    );

    expect(
      await screen.findByText(
        "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
      ),
    ).toBeTruthy();
  });

  it("should toggle password visibility", () => {
    mockedUseAuth.mockReturnValue({
      signIn: jest.fn(),
    });

    render(<SignIn />, { wrapper: ToastProvider });

    const toggle = screen.getByText("EyeIcon");

    fireEvent.press(toggle);

    expect(screen.getByText("EyeOffIcon")).toBeTruthy();
  });

  it("should navigate to sign-up screen", () => {
    mockedUseAuth.mockReturnValue({
      signIn: jest.fn(),
    });

    render(<SignIn />, { wrapper: ToastProvider });

    fireEvent.press(screen.getByText("Cadastre-se"));

    expect(mockedPush).toHaveBeenCalledWith("/sign-up");
  });
});
