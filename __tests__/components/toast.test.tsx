import { Toast } from "@/components/toast";
import { fireEvent, render, screen } from "@testing-library/react-native";

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");

  return {
    CircleAlert: (props: any) => <View testID="icon-error" {...props} />,
    CircleCheck: (props: any) => <View testID="icon-success" {...props} />,
    Info: (props: any) => <View testID="icon-info" {...props} />,
  };
});

describe("Toast", () => {
  it("should render the message with the alert role", () => {
    render(
      <Toast type="error" message="Algo deu errado" onDismiss={jest.fn()} />,
    );

    const toast = screen.getByRole("alert");

    expect(toast).toBeTruthy();
    expect(toast.props.accessibilityLiveRegion).toBe("polite");
    expect(screen.getByText("Algo deu errado")).toBeTruthy();
  });

  it("should call onDismiss when pressed", () => {
    const onDismiss = jest.fn();

    render(<Toast type="success" message="Salvo" onDismiss={onDismiss} />);

    fireEvent.press(screen.getByText("Salvo"));

    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("should render the icon of each type", () => {
    const { rerender } = render(
      <Toast type="error" message="Erro" onDismiss={jest.fn()} />,
    );
    expect(screen.getByTestId("icon-error")).toBeTruthy();

    rerender(<Toast type="success" message="Ok" onDismiss={jest.fn()} />);
    expect(screen.getByTestId("icon-success")).toBeTruthy();

    rerender(<Toast type="info" message="Info" onDismiss={jest.fn()} />);
    expect(screen.getByTestId("icon-info")).toBeTruthy();
  });
});
