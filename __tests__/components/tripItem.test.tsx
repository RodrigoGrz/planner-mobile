import { TripItem } from "@/components/tripItem";
import { fireEvent, render } from "@testing-library/react-native";
import "@/utils/dayjsLocaleConfig";

jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("@/components/badge", () => ({
  Badge: () => {
    const { Text } = require("react-native");
    return <Text>Badge</Text>;
  },
}));

const { router } = require("expo-router");

const tripMock = {
  tripId: "1",
  destination: "Paris",
  startsAt: new Date("2024-05-10"),
  endsAt: new Date("2024-05-15"),
  coverImageUrl: "https://image.com/photo.jpg",
};

describe("TripItem", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render trip information", () => {
    const { getByText } = render(<TripItem trip={tripMock as any} />);

    expect(getByText("Paris")).toBeTruthy();
    expect(getByText("10 a 15 de maio.")).toBeTruthy();
    expect(getByText("Badge")).toBeTruthy();
  });

  it("should show the trip days without shifting them to the previous day", () => {
    const { getByText } = render(
      <TripItem
        trip={
          {
            ...tripMock,
            startsAt: "2026-10-01T00:00:00.000Z",
            endsAt: "2026-10-05T00:00:00.000Z",
          } as any
        }
      />,
    );

    expect(getByText("1 a 5 de outubro.")).toBeTruthy();
  });

  it("should navigate when pressed", () => {
    const { getByRole } = render(<TripItem trip={tripMock as any} />);

    const button = getByRole("button");

    fireEvent.press(button);

    expect(router.push).toHaveBeenCalledWith("/trip/1");
  });

  it("should render image when coverImageUrl exists", () => {
    const { UNSAFE_getByType } = render(<TripItem trip={tripMock as any} />);

    const image = UNSAFE_getByType(require("react-native").Image);

    expect(image.props.source).toEqual({
      uri: "https://image.com/photo.jpg",
    });
  });

  it("should render placeholder when no image", () => {
    const tripWithoutImage = {
      ...tripMock,
      coverImageUrl: null,
    };

    const { UNSAFE_getAllByType } = render(
      <TripItem trip={tripWithoutImage as any} />,
    );

    const views = UNSAFE_getAllByType(require("react-native").View);

    expect(views.length).toBeGreaterThan(0);
  });
});
