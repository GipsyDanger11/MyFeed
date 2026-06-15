/**
 * Auth group layout — if the user is already signed in, redirect away
 * to the onboarding flow or dashboard so they never see login/signup again.
 */
import { Stack, useRouter } from "expo-router";
import { useEffect } from "react";

import { useAuth } from "@/contexts/AuthContext";

export default function AuthLayout() {
  const { session, profile, ready } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!ready) return;
    if (session) {
      const target = profile?.onboarded_at ? "/dashboard" : "/pick-topics";
      router.replace(target);
    }
  }, [session, profile, ready, router]);

  if (!ready) return null;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: "transparent" },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="login" />
      <Stack.Screen name="signup" />
    </Stack>
  );
}
