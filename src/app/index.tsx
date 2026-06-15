/**
 * Entry router — redirects the user to the right stack based on
 * their auth state + onboarding completion.
 *
 *   not signed in           -> /login
 *   signed in, no onboarded -> /welcome
 *   signed in, onboarded    -> /dashboard
 *
 * The layout's Boot component handles re-direction after auth changes
 * (sign-in / sign-out) since this screen is unmounted after the first redirect.
 */
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { GradientBackground } from "@/components/glass";
import { Colors } from "@/constants/colors";
import { useAuth } from "@/contexts/AuthContext";

export default function Index() {
  const { session, profile, ready } = useAuth();

  if (!ready) {
    return (
      <GradientBackground>
        <View style={styles.center}>
          <ActivityIndicator color={Colors.pink} size="large" />
        </View>
      </GradientBackground>
    );
  }

  if (!session) {
    return <Redirect href="/login" />;
  }

  if (!profile?.onboarded_at) {
    return <Redirect href="/pick-topics" />;
  }

  return <Redirect href="/dashboard" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
