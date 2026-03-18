import { Input } from "@/components/input";
import { fireEvent, render } from "@testing-library/react-native";

describe("Input", () => {
  it("should render children correctly", () => {
    const { getByPlaceholderText } = render(
      <Input>
        <Input.Field placeholder="Type here" />
      </Input>,
    );

    expect(getByPlaceholderText("Type here")).toBeTruthy();
  });

  it("should call onChangeText when typing", () => {
    const onChangeTextMock = jest.fn();

    const { getByPlaceholderText } = render(
      <Input>
        <Input.Field placeholder="Type here" onChangeText={onChangeTextMock} />
      </Input>,
    );

    const input = getByPlaceholderText("Type here");

    fireEvent.changeText(input, "Hello");

    expect(onChangeTextMock).toHaveBeenCalledWith("Hello");
  });

  it("should pass props to TextInput", () => {
    const { getByPlaceholderText } = render(
      <Input>
        <Input.Field placeholder="Email" />
      </Input>,
    );

    const input = getByPlaceholderText("Email");

    expect(input).toBeTruthy();
  });
});
