import { getTripStatus } from "@/utils/trip-status";
import { Text, View } from "react-native";

type StatusBadgeProps = {
  startsAt: string;
  endsAt: string;
};

export function Badge({ startsAt, endsAt }: StatusBadgeProps) {
  const status = getTripStatus(startsAt, endsAt);

  return (
    <View className={`px-2 py-1 rounded-full ${status.color}`}>
      <Text className={`text-xs font-semibold ${status.textColor}`}>
        {status.label}
      </Text>
    </View>
  );
}
