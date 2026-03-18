import { Toggle } from "@/components/toggle";
import { fireEvent, render } from "@testing-library/react-native";
import { Switch } from "react-native";

describe("Toggle", () => {
  it("should render children", () => {
    const { getByText } = render(
      <Toggle value={false} onChange={() => {}}>
        <Toggle.Label>Label</Toggle.Label>
      </Toggle>,
    );

    expect(getByText("Label")).toBeTruthy();
  });

  it("should call onChange when toggled", () => {
    const onChangeMock = jest.fn();

    const { UNSAFE_getByType } = render(
      <Toggle value={false} onChange={onChangeMock}>
        <Toggle.Label>Label</Toggle.Label>
      </Toggle>,
    );

    const switchEl = UNSAFE_getByType(Switch);

    fireEvent(switchEl, "valueChange", true);

    expect(onChangeMock).toHaveBeenCalledWith(true);
  });

  it("should render label with secondary variant", () => {
    const { getByText } = render(
      <Toggle value={false} onChange={() => {}} variant="secondary">
        <Toggle.Label>Label</Toggle.Label>
      </Toggle>,
    );

    expect(getByText("Label")).toBeTruthy();
  });

  it("should render label on the right when position is right", () => {
    const { getByText } = render(
      <Toggle value={false} onChange={() => {}} position="right">
        <Toggle.Label>Label</Toggle.Label>
      </Toggle>,
    );

    expect(getByText("Label")).toBeTruthy();
  });
});
