import { Loading } from "@/components/loading";
import { useAuth } from "@/hooks/useAuth";
import { Redirect, Slot } from "expo-router";

export default function AppLayout() {
  const { user, isLoadingUserStorageData } = useAuth();

  if (isLoadingUserStorageData) return <Loading />;

  if (!user) {
    return <Redirect href="/(auth)/sign-in" />;
  }

  return <Slot />;
}
