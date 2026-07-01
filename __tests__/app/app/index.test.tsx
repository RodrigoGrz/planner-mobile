jest.mock("expo-router", () => ({
  router: {
    push: jest.fn(),
  },
}));

jest.mock("@/hooks/useAuth", () => ({
  useAuth: jest.fn(),
}));

jest.mock("@/hooks/useTrips", () => ({
  useTrips: jest.fn(),
}));

jest.mock("@/components/loading", () => {
  const { ActivityIndicator } = require("react-native");
  return {
    Loading: () => <ActivityIndicator testID="loading-indicator" />,
  };
});

jest.mock("@/components/nextTrip", () => {
  const { Text } = require("react-native");
  return {
    NextTrip: ({ trip }: any) => <Text>{`NextTrip:${trip.tripId}`}</Text>,
  };
});

jest.mock("@/components/tripItem", () => {
  const { Text } = require("react-native");
  return {
    TripItem: ({ trip }: any) => <Text>{`Trip:${trip.tripId}`}</Text>,
  };
});

jest.mock("@/components/button", () => {
  const { TouchableOpacity } = require("react-native");
  return {
    Button: ({ children, onPress }: any) => (
      <TouchableOpacity onPress={onPress}>{children}</TouchableOpacity>
    ),
  };
});

import {
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react-native";

import Index from "@/app/(app)/index";
import { useAuth } from "@/hooks/useAuth";
import { useTrips } from "@/hooks/useTrips";
import { router } from "expo-router";

describe("Index (Home)", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should show loading initially", () => {
    (useAuth as jest.Mock).mockReturnValue({
      signOut: jest.fn(),
    });

    (useTrips as jest.Mock).mockReturnValue({
      trips: [],
      nextTrip: null,
      status: "loading",
    });

    render(<Index />);

    expect(screen.getByTestId("loading-indicator")).toBeTruthy();
  });

  it("should render trips and next trip", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      signOut: jest.fn(),
    });

    (useTrips as jest.Mock).mockReturnValue({
      trips: [{ tripId: "1" }, { tripId: "2" }],
      nextTrip: { tripId: "99" },
      status: "ready",
    });

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("NextTrip:99")).toBeTruthy();
      expect(screen.getByText("Trip:1")).toBeTruthy();
      expect(screen.getByText("Trip:2")).toBeTruthy();
    });
  });

  it("should show empty message when no trips", async () => {
    (useAuth as jest.Mock).mockReturnValue({
      signOut: jest.fn(),
    });

    (useTrips as jest.Mock).mockReturnValue({
      trips: [],
      nextTrip: null,
      status: "ready",
    });

    render(<Index />);

    await waitFor(() => {
      expect(screen.getByText("Nenhuma viagem encontrada")).toBeTruthy();
    });
  });

  it("should call signOut when pressing Sair", async () => {
    const signOutMock = jest.fn();
    (useAuth as jest.Mock).mockReturnValue({ signOut: signOutMock });

    (useTrips as jest.Mock).mockReturnValue({
      trips: [],
      nextTrip: null,
      status: "ready",
    });

    render(<Index />);

    await waitFor(() => screen.getByText("Sair"));

    fireEvent.press(screen.getByText("Sair"));

    expect(signOutMock).toHaveBeenCalled();
  });

  it("should navigate to create trip", async () => {
    (useAuth as jest.Mock).mockReturnValue({ signOut: jest.fn() });
    (useTrips as jest.Mock).mockReturnValue({
      trips: [],
      nextTrip: null,
      status: "ready",
    });

    render(<Index />);

    await waitFor(() => screen.getByText("Criar nova viagem"));

    fireEvent.press(screen.getByText("Criar nova viagem"));

    expect(router.push).toHaveBeenCalledWith("/(app)/trip/create");
  });
});
