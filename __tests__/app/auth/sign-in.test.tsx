import {
    fireEvent,
    render,
    screen,
    waitFor,
} from "@testing-library/react-native";

import SignIn from "@/app/(auth)/sign-in";
import { useAuth } from "@/hooks/useAuth";
import { router } from "expo-router";
import { Alert } from "react-native";

jest.mock("@/hooks/useAuth");

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

    render(<SignIn />);

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

    render(<SignIn />);

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

  it("should show alert when signIn fails", async () => {
    const signInMock = jest.fn().mockRejectedValue(new Error("Erro fake"));

    jest.spyOn(Alert, "alert");

    mockedUseAuth.mockReturnValue({
      signIn: signInMock,
    });

    render(<SignIn />);

    fireEvent.changeText(
      screen.getByPlaceholderText("E-mail"),
      "test@mail.com",
    );
    fireEvent.changeText(screen.getByPlaceholderText("Senha"), "123456");

    fireEvent.press(screen.getByText("Entrar"));

    await waitFor(() => {
      expect(Alert.alert).toHaveBeenCalledWith("Login", "Erro fake");
    });
  });

  it("should toggle password visibility", () => {
    mockedUseAuth.mockReturnValue({
      signIn: jest.fn(),
    });

    render(<SignIn />);

    const toggle = screen.getByText("EyeIcon");

    fireEvent.press(toggle);

    expect(screen.getByText("EyeOffIcon")).toBeTruthy();
  });

  it("should navigate to sign-up screen", () => {
    mockedUseAuth.mockReturnValue({
      signIn: jest.fn(),
    });

    render(<SignIn />);

    fireEvent.press(screen.getByText("Cadastre-se"));

    expect(mockedPush).toHaveBeenCalledWith("/sign-up");
  });
});
