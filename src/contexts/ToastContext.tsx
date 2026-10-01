import { Toast, ToastType } from "@/components/toast";
import { getFriendlyErrorMessage } from "@/utils/get-friendly-error-message";
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type ToastContextData = {
  showError: (error: unknown, fallback: string) => void;
  showErrorMessage: (message: string) => void;
  showSuccess: (message: string) => void;
  showInfo: (message: string) => void;
  hide: () => void;
};

type ToastProviderProps = {
  children: ReactNode;
};

type ToastState = {
  id: number;
  type: ToastType;
  message: string;
};

const TOAST_DURATION_MS: Record<ToastType, number> = {
  error: 6000,
  success: 4000,
  info: 4000,
};

const TOAST_TOP_SPACING = 8;

const ToastContext = createContext<ToastContextData | null>(null);

export function ToastProvider({ children }: ToastProviderProps) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const nextIdRef = useRef(0);

  const clearTimer = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const hide = useCallback(() => {
    clearTimer();
    setToast(null);
  }, [clearTimer]);

  const show = useCallback(
    (type: ToastType, message: string) => {
      clearTimer();
      nextIdRef.current += 1;
      setToast({ id: nextIdRef.current, type, message });
      timerRef.current = setTimeout(hide, TOAST_DURATION_MS[type]);
    },
    [clearTimer, hide],
  );

  useEffect(() => clearTimer, [clearTimer]);

  const value = useMemo<ToastContextData>(
    () => ({
      showError: (error, fallback) =>
        show("error", getFriendlyErrorMessage(error, fallback)),
      showErrorMessage: (message) => show("error", message),
      showSuccess: (message) => show("success", message),
      showInfo: (message) => show("info", message),
      hide,
    }),
    [show, hide],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast ? (
        <View
          pointerEvents="box-none"
          className="absolute left-0 right-0 z-[60]"
          style={{ top: insets.top + TOAST_TOP_SPACING }}
        >
          <Toast
            key={toast.id}
            type={toast.type}
            message={toast.message}
            onDismiss={hide}
          />
        </View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast() {
  const context = useContext(ToastContext);

  if (!context) {
    throw new Error("useToast must be used within a ToastProvider");
  }

  return context;
}
