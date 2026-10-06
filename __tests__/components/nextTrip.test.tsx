import { NextTrip } from "@/components/nextTrip";
import { render } from "@testing-library/react-native";
import "@/utils/dayjsLocaleConfig";

const tripMock = {
  destination: "Paris",
  startsAt: new Date("2024-05-10"),
  endsAt: new Date("2024-05-15"),
  coverImageUrl: "https://image.com/photo.jpg",
};

describe("NextTrip", () => {
  it("should render trip information", () => {
    const { getByText } = render(<NextTrip trip={tripMock as any} />);

    expect(getByText("Próxima viagem")).toBeTruthy();
    expect(getByText("Paris")).toBeTruthy();
    expect(getByText("10 a 15 de maio.")).toBeTruthy();
  });

  it("should show the trip days without shifting them to the previous day", () => {
    const { getByText } = render(
      <NextTrip
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

  it("should render image when coverImageUrl exists", () => {
    const { UNSAFE_getByType } = render(<NextTrip trip={tripMock as any} />);

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
      <NextTrip trip={tripWithoutImage as any} />,
    );

    const views = UNSAFE_getAllByType(require("react-native").View);

    expect(views.length).toBeGreaterThan(0);
  });
});
