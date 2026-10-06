import { SyncProvider } from "@/contexts/SyncContext";
import { ToastProvider } from "@/contexts/ToastContext";
import { act, render, screen, waitFor } from "@testing-library/react-native";
import { Text } from "react-native";

const mockFailureListeners: Array<(event: { message: string }) => void> = [];
const mockUnsubscribeFailure = jest.fn();

jest.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: null }),
}));

jest.mock("@/contexts/NetworkContext", () => ({
  useNetwork: () => ({
    isOnline: false,
    registerReconnectCallback: jest.fn(() => jest.fn()),
  }),
}));

jest.mock("@/services/mutation-service", () => ({
  setMutationOnlineChecker: jest.fn(),
}));

jest.mock("@/services/sync-engine", () => ({
  getIsSyncing: jest.fn(() => false),
  getSyncCounts: jest.fn(() =>
    Promise.resolve({ pendingCount: 0, failedCount: 0, syncingCount: 0 }),
  ),
  retryFailedSync: jest.fn(),
  runInitialSyncIfOnline: jest.fn(),
  runSyncOnReconnect: jest.fn(),
  subscribeSyncStatus: jest.fn(() => jest.fn()),
  subscribeSyncFailure: jest.fn(
    (listener: (event: { message: string }) => void) => {
      mockFailureListeners.push(listener);
      return mockUnsubscribeFailure;
    },
  ),
}));

jest.mock("react-native-safe-area-context", () => ({
  useSafeAreaInsets: () => ({ top: 0, right: 0, bottom: 0, left: 0 }),
}));

jest.mock("lucide-react-native", () => new Proxy({}, { get: () => () => null }));

function renderSyncProvider() {
  return render(
    <ToastProvider>
      <SyncProvider>
        <Text>app</Text>
      </SyncProvider>
    </ToastProvider>,
  );
}

describe("SyncProvider", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFailureListeners.length = 0;
  });

  it("should show an error toast when the sync engine notifies a failure", async () => {
    renderSyncProvider();

    await waitFor(() => {
      expect(mockFailureListeners).toHaveLength(1);
    });

    act(() => {
      mockFailureListeners[0]({
        message: "Esta viagem não existe mais e foi removida do aparelho.",
      });
    });

    expect(
      await screen.findByText(
        "Esta viagem não existe mais e foi removida do aparelho.",
      ),
    ).toBeTruthy();
  });

  it("should stop listening to failures after unmount", async () => {
    const { unmount } = renderSyncProvider();

    await waitFor(() => {
      expect(mockFailureListeners).toHaveLength(1);
    });

    unmount();

    expect(mockUnsubscribeFailure).toHaveBeenCalledTimes(1);
  });
});
