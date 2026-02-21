import { colors } from "@/styles/colors";
import clsx from "clsx";
import { createContext, useContext } from "react";
import { Switch, Text, View } from "react-native";

type Variants = "primary" | "secondary";

type Position = "left" | "right";

type ToggleProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  variant?: Variants;
  position?: Position;
  className?: string;
  children?: React.ReactNode;
};

const ThemeContext = createContext<{ variant?: Variants }>({});

function Toggle({
  value,
  onChange,
  variant = "primary",
  className,
  children,
  position = "left",
}: ToggleProps) {
  const isLeft = position === "left";

  return (
    <ThemeContext.Provider value={{ variant }}>
      <View className={clsx("flex-row items-center gap-1", className)}>
        {isLeft && children}

        <Switch
          trackColor={{
            false: "#767577",
            true: colors.lime[950],
          }}
          thumbColor={value ? colors.lime[300] : colors.zinc[100]}
          ios_backgroundColor="#3e3e3e"
          onValueChange={onChange}
          value={value}
        />

        {!isLeft && children}
      </View>
    </ThemeContext.Provider>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  const { variant } = useContext(ThemeContext);

  return (
    <Text
      className={clsx("text-base", {
        "text-lime-950": variant === "primary",
        "text-zinc-300": variant === "secondary",
      })}
    >
      {children}
    </Text>
  );
}

Toggle.Label = Label;

export { Toggle };
