/**
 * App group layout — if the user is not signed in, redirect to login.
 * If they haven't completed onboarding, send them to the welcome screen.
 */
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";

export default function AppLayout() {
  const { session, profile, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
    } else if (!profile?.onboarded_at) {
      router.replace("/pick-topics");
    }
  }, [session, profile, ready, router]);

  if (!ready) return null;

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
      <Stack.Screen name="connect-instagram" options={{ animation: "slide_from_right" }} />
    </Stack>
  );
}
