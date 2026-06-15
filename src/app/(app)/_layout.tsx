import { Stack } from "expo-router";

export default function AppLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "fade",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="dashboard" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="preferences" options={{ animation: "slide_from_right" }} />
      <Stack.Screen name="privacy" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
