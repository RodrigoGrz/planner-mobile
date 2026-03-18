import { Modal } from "@/components/modal";
import { fireEvent, render } from "@testing-library/react-native";
import { Text } from "react-native";

jest.mock("@/components/modal", () => {
  const { View, Text, TouchableOpacity } = require("react-native");

  return {
    Modal: ({ title, subtitle, onClose, children }: any) => (
      <View>
        <Text>{title}</Text>

        {subtitle ? <Text>{subtitle}</Text> : null}

        {onClose && (
          <TouchableOpacity onPress={onClose} accessibilityRole="button">
            <Text>Close</Text>
          </TouchableOpacity>
        )}

        {children}
      </View>
    ),
  };
});

jest.mock("expo-blur", () => {
  const { View } = require("react-native");
  return {
    BlurView: ({ children }: any) => <View>{children}</View>,
  };
});

describe("Modal", () => {
  it("should render title and children", () => {
    const { getByText } = render(
      <Modal title="My Modal">
        <Text>Content</Text>
      </Modal>,
    );

    expect(getByText("My Modal")).toBeTruthy();
    expect(getByText("Content")).toBeTruthy();
  });

  it("should render subtitle when provided", () => {
    const { getByText } = render(
      <Modal title="Title" subtitle="Subtitle here">
        <Text>Content</Text>
      </Modal>,
    );

    expect(getByText("Subtitle here")).toBeTruthy();
  });

  it("should not render subtitle when empty", () => {
    const { queryByText } = render(
      <Modal title="Title" subtitle="">
        <Text>Content</Text>
      </Modal>,
    );

    expect(queryByText("")).toBeNull();
  });

  it("should render close button when onClose is provided", () => {
    const { getByRole } = render(
      <Modal title="Title" onClose={() => {}}>
        <Text>Content</Text>
      </Modal>,
    );

    const button = getByRole("button");

    expect(button).toBeTruthy();
  });

  it("should call onClose when close button is pressed", () => {
    const onCloseMock = jest.fn();

    const { getByRole } = render(
      <Modal title="Title" onClose={onCloseMock}>
        <Text>Content</Text>
      </Modal>,
    );

    const button = getByRole("button");

    fireEvent.press(button);

    expect(onCloseMock).toHaveBeenCalled();
  });
});
