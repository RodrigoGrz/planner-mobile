import { ToastProvider, useToast } from "@/contexts/ToastContext";
import { AppError } from "@/utils/app-error";
import {
  act,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react-native";
import { Pressable, Text } from "react-native";

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 24, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");

  return {
    CircleAlert: (props: any) => <View {...props} />,
    CircleCheck: (props: any) => <View {...props} />,
    Info: (props: any) => <View {...props} />,
  };
});

type Action = (toast: ReturnType<typeof useToast>) => void;

function Trigger({ label, action }: { label: string; action: Action }) {
  const toast = useToast();

  return (
    <Pressable onPress={() => action(toast)}>
      <Text>{label}</Text>
    </Pressable>
  );
}

function renderWithTriggers(triggers: Record<string, Action>) {
  return render(
    <ToastProvider>
      {Object.entries(triggers).map(([label, action]) => (
        <Trigger key={label} label={label} action={action} />
      ))}
    </ToastProvider>,
  );
}

describe("ToastProvider", () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("should show the friendly message when showError is called", () => {
    renderWithTriggers({
      fail: (toast) =>
        toast.showError(
          new AppError("Sem conexão com o servidor.", { code: "NETWORK" }),
          "Não foi possível entrar.",
        ),
    });

    fireEvent.press(screen.getByText("fail"));

    expect(
      screen.getByText(
        "Sem conexão com o servidor. Verifique sua internet e tente novamente.",
      ),
    ).toBeTruthy();
  });

  it("should show the fallback for unknown errors", () => {
    renderWithTriggers({
      fail: (toast) => toast.showError(new Error("boom"), "Não foi possível salvar."),
    });

    fireEvent.press(screen.getByText("fail"));

    expect(screen.getByText("Não foi possível salvar.")).toBeTruthy();
  });

  it("should show a plain error message", () => {
    renderWithTriggers({
      invalid: (toast) => toast.showErrorMessage("Informe um título para o link."),
    });

    fireEvent.press(screen.getByText("invalid"));

    expect(screen.getByText("Informe um título para o link.")).toBeTruthy();
  });

  it("should hide the toast after the timeout", () => {
    renderWithTriggers({
      ok: (toast) => toast.showSuccess("Viagem criada!"),
    });

    fireEvent.press(screen.getByText("ok"));
    expect(screen.getByText("Viagem criada!")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(4000);
    });

    expect(screen.queryByText("Viagem criada!")).toBeNull();
  });

  it("should keep error toasts longer than success toasts", () => {
    renderWithTriggers({
      fail: (toast) => toast.showError(new Error("boom"), "Falhou."),
    });

    fireEvent.press(screen.getByText("fail"));

    act(() => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.getByText("Falhou.")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(2000);
    });
    expect(screen.queryByText("Falhou.")).toBeNull();
  });

  it("should replace the current toast with a new one", () => {
    renderWithTriggers({
      first: (toast) => toast.showInfo("Primeiro"),
      second: (toast) => toast.showSuccess("Segundo"),
    });

    fireEvent.press(screen.getByText("first"));

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    fireEvent.press(screen.getByText("second"));

    expect(screen.queryByText("Primeiro")).toBeNull();
    expect(screen.getByText("Segundo")).toBeTruthy();

    act(() => {
      jest.advanceTimersByTime(3000);
    });

    expect(screen.getByText("Segundo")).toBeTruthy();
  });

  it("should hide the toast when it is pressed", () => {
    renderWithTriggers({
      ok: (toast) => toast.showSuccess("Salvo"),
    });

    fireEvent.press(screen.getByText("ok"));
    fireEvent.press(screen.getByText("Salvo"));

    expect(screen.queryByText("Salvo")).toBeNull();
  });

  it("should clear the timer on unmount", () => {
    const setTimeoutSpy = jest.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = jest.spyOn(globalThis, "clearTimeout");
    const { unmount } = renderWithTriggers({
      ok: (toast) => toast.showSuccess("Salvo"),
    });

    fireEvent.press(screen.getByText("ok"));

    const hideTimerIndex = setTimeoutSpy.mock.calls.findIndex(
      ([, delay]) => delay === 4000,
    );
    const hideTimer = setTimeoutSpy.mock.results[hideTimerIndex].value;

    unmount();

    expect(clearTimeoutSpy).toHaveBeenCalledWith(hideTimer);

    setTimeoutSpy.mockRestore();
    clearTimeoutSpy.mockRestore();
  });

  it("should throw when used outside the provider", () => {
    jest.spyOn(console, "error").mockImplementation(() => {});

    expect(() => renderHook(() => useToast())).toThrow(
      "useToast must be used within a ToastProvider",
    );
  });
});
