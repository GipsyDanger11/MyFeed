/**
 * Root layout — wraps every screen in:
 *   1. AuthProvider — exposes the current Supabase user + profile
 *   2. SafeAreaProvider
 *   3. Stack with global loading spinner
 */
import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";

import { GradientBackground } from "@/components/glass";
import { AuthProvider, useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

import "@/global.css";

function Boot() {
  const { ready } = useAuth();
  if (!ready) {
    return (
      <GradientBackground>
        <View style={styles.boot}>
          <ActivityIndicator color={Colors.pink} size="large" />
        </View>
      </GradientBackground>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "fade",
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="(auth)" />
      <Stack.Screen name="(onboarding)" options={{ gestureEnabled: false }} />
      <Stack.Screen name="(app)" options={{ gestureEnabled: false }} />
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <AuthProvider>
        <Boot />
      </AuthProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  boot: { flex: 1, alignItems: "center", justifyContent: "center" },
});
