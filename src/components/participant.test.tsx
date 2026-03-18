import { Participant } from "@/components/participant";
import { render } from "@testing-library/react-native";

jest.mock("lucide-react-native", () => ({
  CircleCheck: (props: any) => {
    const { View } = require("react-native");
    return <View {...props} testID="icon-check" />;
  },
  CircleDashed: (props: any) => {
    const { View } = require("react-native");
    return <View {...props} testID="icon-dashed" />;
  },
}));

describe("Participant", () => {
  it("should render name when provided", () => {
    const { getByText } = render(
      <Participant
        data={{
          id: "1",
          name: "Rodrigo",
          email: "rodrigo@email.com",
          isConfirmed: true,
        }}
      />,
    );

    expect(getByText("Rodrigo")).toBeTruthy();
  });

  it("should render 'Pendente' when name is not provided", () => {
    const { getByText } = render(
      <Participant
        data={{
          id: "1",
          email: "teste@email.com",
          isConfirmed: false,
        }}
      />,
    );

    expect(getByText("Pendente")).toBeTruthy();
  });

  it("should render email", () => {
    const { getByText } = render(
      <Participant
        data={{
          id: "1",
          name: "Rodrigo",
          email: "rodrigo@email.com",
          isConfirmed: true,
        }}
      />,
    );

    expect(getByText("rodrigo@email.com")).toBeTruthy();
  });

  it("should render check icon when confirmed", () => {
    const { getByTestId, queryByTestId } = render(
      <Participant
        data={{
          id: "1",
          name: "Rodrigo",
          email: "rodrigo@email.com",
          isConfirmed: true,
        }}
      />,
    );

    expect(getByTestId("icon-check")).toBeTruthy();
    expect(queryByTestId("icon-dashed")).toBeNull();
  });

  it("should render dashed icon when not confirmed", () => {
    const { getByTestId, queryByTestId } = render(
      <Participant
        data={{
          id: "1",
          name: "Rodrigo",
          email: "rodrigo@email.com",
          isConfirmed: false,
        }}
      />,
    );

    expect(getByTestId("icon-dashed")).toBeTruthy();
    expect(queryByTestId("icon-check")).toBeNull();
  });
});
