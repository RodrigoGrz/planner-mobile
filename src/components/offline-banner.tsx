import { useNetwork } from "@/contexts/NetworkContext";
import { useSync } from "@/contexts/SyncContext";
import { Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

export function OfflineBanner() {
  const { isOnline } = useNetwork();
  const { pendingCount, failedCount, syncingCount, isSyncing, retryFailed } =
    useSync();
  const insets = useSafeAreaInsets();

  const totalPending = pendingCount + syncingCount;

  if (isOnline && totalPending === 0 && failedCount === 0 && !isSyncing) {
    return null;
  }

  let message = "Sem conexão. Alterações serão sincronizadas depois.";

  if (isOnline && isSyncing) {
    message = "Sincronizando alterações...";
  } else if (isOnline && failedCount > 0) {
    message = `${failedCount} alteração(ões) com falha na sincronização.`;
  } else if (isOnline && totalPending > 0) {
    message = `${totalPending} alteração(ões) aguardando sincronização.`;
  } else if (!isOnline && totalPending + failedCount > 0) {
    message = `Sem conexão. ${totalPending + failedCount} alteração(ões) pendentes.`;
  }

  return (
    <View
      className="absolute left-0 right-0 z-50 bg-amber-900/90 px-4 py-2"
      style={{ top: insets.top }}
    >
      <Text className="text-amber-100 text-center text-sm">{message}</Text>
      {isOnline && failedCount > 0 && !isSyncing ? (
        <Pressable onPress={() => void retryFailed()} className="mt-1">
          <Text className="text-amber-50 text-center text-sm underline">
            Tentar novamente
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
