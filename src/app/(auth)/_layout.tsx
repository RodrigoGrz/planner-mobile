import { Loading } from "@/components/loading"
import { useAuth } from "@/hooks/useAuth"
import { Redirect, Slot } from "expo-router"

export default function AuthLayout() {
  const { user, isLoadingUserStorageData } = useAuth()

  if (isLoadingUserStorageData) {
    return <Loading />
  }

  if (user) {
    return <Redirect href="/(app)" />
  }

  return <Slot />
}
