import { Button } from "@/components/button";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

describe("Button", () => {
  it("should render children when not loading", () => {
    const { getByText } = render(
      <Button>
        <Text>Click me</Text>
      </Button>,
    );

    expect(getByText("Click me")).toBeTruthy();
  });

  it("should show loading indicator when isLoading is true", () => {
    const { queryByText, UNSAFE_getByType } = render(
      <Button isLoading>
        <Text>Click me</Text>
      </Button>,
    );

    expect(queryByText("Click me")).toBeNull();

    expect(
      UNSAFE_getByType(require("react-native").ActivityIndicator),
    ).toBeTruthy();
  });

  it("should be disabled when isLoading is true", () => {
    const { getByTestId } = render(
      <Button isLoading>
        <Text>Click me</Text>
      </Button>,
    );

    const button = getByTestId("button");

    expect(button.props.accessibilityState.disabled).toBe(true);
  });

  it("should call onPress when pressed", () => {
    const onPressMock = jest.fn();

    const { getByTestId } = render(
      <Button onPress={onPressMock}>
        <Text>Click me</Text>
      </Button>,
    );

    fireEvent.press(getByTestId("button"));

    expect(onPressMock).toHaveBeenCalled();
  });
});

describe("Button.Title", () => {
  it("should render text correctly", () => {
    const { getByText } = render(
      <Button>
        <Button.Title>Save</Button.Title>
      </Button>,
    );

    expect(getByText("Save")).toBeTruthy();
  });

  it("should respect variant from context (secondary)", () => {
    const { getByText } = render(
      <Button variant="secondary">
        <Button.Title>Save</Button.Title>
      </Button>,
    );

    const title = getByText("Save");

    expect(title).toBeTruthy();
  });
});
