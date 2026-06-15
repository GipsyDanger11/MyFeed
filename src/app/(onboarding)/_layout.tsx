/**
 * Onboarding group layout — if the user is not signed in, redirect to login.
 * If already onboarded, redirect to dashboard.
 */
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";

export default function OnboardingLayout() {
  const { session, profile, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (!session) {
      router.replace("/login");
    } else if (profile?.onboarded_at) {
      router.replace("/dashboard");
    }
  }, [session, profile, ready, router]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "slide_from_right",
        gestureEnabled: false,
      }}
    >
      <Stack.Screen name="pick-topics" />
      <Stack.Screen name="connect-instagram" />
      <Stack.Screen name="complete" />
    </Stack>
  );
}
