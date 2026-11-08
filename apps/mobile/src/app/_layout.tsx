import { Stack, router, useRootNavigationState } from "expo-router";
import { useFonts } from "expo-font";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { useEffect } from "react";
import { AppProvider, useApp } from "../lib/state";
function FirstLaunch() {
  const nav = useRootNavigationState();
  const { ready, onboarded } = useApp();
  useEffect(() => {
    if (nav?.key && ready && !onboarded) router.replace("/welcome");
  }, [nav?.key, ready, onboarded]);
  return null;
}
export default function Layout() {
  const [loaded, error] = useFonts({
    Manrope_400Regular: require("../../assets/fonts/Manrope_400Regular.ttf"),
    Manrope_500Medium: require("../../assets/fonts/Manrope_500Medium.ttf"),
    Manrope_600SemiBold: require("../../assets/fonts/Manrope_600SemiBold.ttf"),
    Manrope_700Bold: require("../../assets/fonts/Manrope_700Bold.ttf"),
  });
  if (error) throw error;
  if (!loaded) return null;
  return (
    <SafeAreaProvider>
      <AppProvider>
        <StatusBar style="light" />
        <FirstLaunch />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "#0d0d0d" },
          }}
        />
      </AppProvider>
    </SafeAreaProvider>
  );
}
