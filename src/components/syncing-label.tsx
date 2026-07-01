import { Text } from "react-native";

type SyncingLabelProps = {
  visible: boolean;
};

export function SyncingLabel({ visible }: SyncingLabelProps) {
  if (!visible) {
    return null;
  }

  return (
    <Text className="text-zinc-500 text-sm mt-1">Sincronizando...</Text>
  );
}
