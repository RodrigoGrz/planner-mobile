import "@/styles/global.css"
import "@/utils/dayjsLocaleConfig"

import { Slot } from "expo-router"
import { useEffect, useState } from "react"
import { StatusBar, View } from "react-native"

import { Inter_400Regular, Inter_500Medium, Inter_600SemiBold, useFonts } from "@expo-google-fonts/inter"

import { Loading } from "@/components/loading"
import { OfflineBanner } from "@/components/offline-banner"
import { AuthContextProvider } from "@/contexts/AuthContext"
import { NetworkProvider } from "@/contexts/NetworkContext"
import { SyncProvider } from "@/contexts/SyncContext"
import { initDatabase } from "@/database/init"

export default function RootLayout() {
    const [fontsLoaded] = useFonts({
        Inter_500Medium,
        Inter_400Regular,
        Inter_600SemiBold,
    })
    const [isDatabaseReady, setIsDatabaseReady] = useState(false)

    useEffect(() => {
        initDatabase()
            .then(() => setIsDatabaseReady(true))
            .catch((error) => {
                console.error("Failed to initialize database:", error)
            })
    }, [])

    if (!fontsLoaded || !isDatabaseReady) {
        return <Loading />
    }

    return (
        <AuthContextProvider>
            <NetworkProvider>
                <SyncProvider>
                    <View className="flex-1 bg-zinc-950">
                        <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
                        <OfflineBanner />
                        <Slot />
                    </View>
                </SyncProvider>
            </NetworkProvider>
        </AuthContextProvider>
    )
}
