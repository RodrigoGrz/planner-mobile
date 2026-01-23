import "@/styles/global.css"
import "@/utils/dayjsLocaleConfig"

import { Slot } from "expo-router"
import { StatusBar, View } from "react-native"

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter"

import { Loading } from "@/components/loading"
import { AuthContextProvider } from "@/contexts/AuthContext"

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Inter_500Medium,
        Inter_400Regular,
        Inter_600SemiBold,
    })

    if (!fontsLoaded) {
        return <Loading />
    }

    return (
        <AuthContextProvider>
            <View className="flex-1 bg-zinc-950">
                <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                <Slot />
            </View>
        </AuthContextProvider>
    )
}