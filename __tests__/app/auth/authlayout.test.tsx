import { render, screen } from "@testing-library/react-native";

import AuthLayout from "@/app/(auth)/_layout";
import { useAuth } from "@/hooks/useAuth";
import { Redirect } from "expo-router";

jest.mock("@/hooks/useAuth");

jest.mock("expo-router", () => {
  const { Text } = require("react-native");

  return {
    Redirect: jest.fn(() => <Text>Redirect</Text>),
    Slot: jest.fn(() => <Text>Slot</Text>),
  };
});

jest.mock("@/components/loading", () => {
  const { Text } = require("react-native");

  return {
    Loading: () => <Text>Loading</Text>,
  };
});

const mockedUseAuth = useAuth as jest.Mock;

describe("AuthLayout", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should render loading when isLoadingUserStorageData is true", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoadingUserStorageData: true,
    });

    render(<AuthLayout />);

    expect(screen.getByText("Loading")).toBeTruthy();
  });

  it("should redirect when user is authenticated", () => {
    mockedUseAuth.mockReturnValue({
      user: { id: "1" },
      isLoadingUserStorageData: false,
    });

    render(<AuthLayout />);

    expect(screen.UNSAFE_getByType(Redirect)).toBeTruthy();
  });

  it("should render Slot when user is not authenticated", () => {
    mockedUseAuth.mockReturnValue({
      user: null,
      isLoadingUserStorageData: false,
    });

    render(<AuthLayout />);

    expect(screen.getByText("Slot")).toBeTruthy();
  });
});
