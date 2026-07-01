import NetInfo from "@react-native-community/netinfo";
import {
  ReactNode,
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

type NetworkContextData = {
  isOnline: boolean;
  isInternetReachable: boolean | null;
  registerReconnectCallback: (callback: () => void) => () => void;
};

const NetworkContext = createContext<NetworkContextData>({} as NetworkContextData);

type NetworkProviderProps = {
  children: ReactNode;
};

export function NetworkProvider({ children }: NetworkProviderProps) {
  const [isOnline, setIsOnline] = useState(true);
  const [isInternetReachable, setIsInternetReachable] = useState<boolean | null>(
    true,
  );
  const reconnectCallbacks = useRef<Set<() => void>>(new Set());
  const wasOffline = useRef(false);

  const registerReconnectCallback = useCallback((callback: () => void) => {
    reconnectCallbacks.current.add(callback);

    return () => {
      reconnectCallbacks.current.delete(callback);
    };
  }, []);

  const notifyReconnect = useCallback(() => {
    reconnectCallbacks.current.forEach((callback) => {
      callback();
    });
  }, []);

  useEffect(() => {
    NetInfo.fetch().then((state) => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );

      setIsOnline(connected);
      setIsInternetReachable(state.isInternetReachable);
      wasOffline.current = !connected;
    });

    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = Boolean(
        state.isConnected && state.isInternetReachable !== false,
      );

      const cameBackOnline = wasOffline.current && connected;

      setIsOnline(connected);
      setIsInternetReachable(state.isInternetReachable);
      wasOffline.current = !connected;

      if (cameBackOnline) {
        notifyReconnect();
      }
    });

    return unsubscribe;
  }, [notifyReconnect]);

  return (
    <NetworkContext.Provider
      value={{ isOnline, isInternetReachable, registerReconnectCallback }}
    >
      {children}
    </NetworkContext.Provider>
  );
}

export function useNetwork() {
  return useContext(NetworkContext);
}
