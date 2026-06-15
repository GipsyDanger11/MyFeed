import { Stack } from "expo-router";

export default function OnboardingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="index" />
      <Stack.Screen name="preferences" />
      <Stack.Screen name="connect-instagram" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
