import { useNetwork } from "@/contexts/NetworkContext";
import { Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const insets = useSafeAreaInsets();

  if (isOnline) {
    return null;
  }

  return (
    <View
      className="absolute left-0 right-0 z-50 bg-amber-900/90 px-4 py-2"
      style={{ top: insets.top }}
    >
      <Text className="text-amber-100 text-center text-sm">
        Sem conexão. Exibindo dados salvos.
      </Text>
    </View>
  );
}
