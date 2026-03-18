import { Activity } from "@/components/activity";
import { render } from "@testing-library/react-native";

jest.mock("lucide-react-native", () => {
  const { View } = require("react-native");

  return {
    CircleCheck: (props: any) => <View {...props} />,
    CircleDashed: (props: any) => <View {...props} />,
  };
});

describe("Activity", () => {
  const baseData = {
    id: "1",
    title: "Check-in",
    hour: "10:00",
  };

  it("should render title and hour correctly", () => {
    const { getByText } = render(
      <Activity
        data={{
          ...baseData,
          isBefore: true,
        }}
      />,
    );

    expect(getByText("Check-in")).toBeTruthy();
    expect(getByText("10:00")).toBeTruthy();
  });

  it("should render check icon when isBefore is true", () => {
    const { queryByTestId } = render(
      <Activity
        data={{
          ...baseData,
          isBefore: true,
        }}
      />,
    );

    expect(queryByTestId("icon-check")).toBeTruthy();
  });

  it("should render dashed icon when isBefore is false", () => {
    const { queryByTestId } = render(
      <Activity
        data={{
          ...baseData,
          isBefore: false,
        }}
      />,
    );

    expect(queryByTestId("icon-dashed")).toBeTruthy();
  });

  it("should not render check icon when isBefore is false", () => {
    const { queryByTestId } = render(
      <Activity
        data={{
          ...baseData,
          isBefore: false,
        }}
      />,
    );

    expect(queryByTestId("icon-check")).toBeNull();
  });

  it("should not render dashed icon when isBefore is true", () => {
    const { queryByTestId } = render(
      <Activity
        data={{
          ...baseData,
          isBefore: true,
        }}
      />,
    );

    expect(queryByTestId("icon-dashed")).toBeNull();
  });
});
