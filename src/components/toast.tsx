import { colors } from "@/styles/colors";
import clsx from "clsx";
import { CircleAlert, CircleCheck, Info } from "lucide-react-native";
import { useEffect, useRef } from "react";
import { Animated, Pressable, Text } from "react-native";

export type ToastType = "error" | "success" | "info";

type ToastProps = {
  type: ToastType;
  message: string;
  onDismiss: () => void;
};

const ERROR_COLOR = "#F87171";

const TOAST_VARIANTS = {
  error: { Icon: CircleAlert, iconColor: ERROR_COLOR, border: "border-red-400" },
  success: { Icon: CircleCheck, iconColor: colors.lime[300], border: "border-lime-300" },
  info: { Icon: Info, iconColor: colors.zinc[300], border: "border-zinc-500" },
} as const;

const ENTER_DURATION_MS = 200;

export function Toast({ type, message, onDismiss }: ToastProps) {
  const progress = useRef(new Animated.Value(0)).current;
  const { Icon, iconColor, border } = TOAST_VARIANTS[type];

  useEffect(() => {
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: ENTER_DURATION_MS,
      useNativeDriver: true,
    });

    animation.start();

    return () => animation.stop();
  }, [progress]);

  return (
    <Animated.View
      style={{
        opacity: progress,
        transform: [
          {
            translateY: progress.interpolate({
              inputRange: [0, 1],
              outputRange: [-12, 0],
            }),
          },
        ],
      }}
    >
      <Pressable
        accessibilityRole="alert"
        accessibilityLiveRegion="polite"
        onPress={onDismiss}
        className={clsx(
          "mx-4 flex-row items-center gap-3 rounded-lg border bg-zinc-900 px-4 py-3",
          border,
        )}
      >
        <Icon color={iconColor} size={20} />
        <Text className="flex-1 font-regular text-sm text-zinc-100">
          {message}
        </Text>
      </Pressable>
    </Animated.View>
  );
}
