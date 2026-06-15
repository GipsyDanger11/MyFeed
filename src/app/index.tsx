/**
 * Entry router — redirects the user to the right stack based on
 * their auth state + onboarding completion.
 *
 *   not signed in           -> /login
 *   signed in, no onboarded -> /onboarding
 *   signed in, onboarded    -> /dashboard
 */
import { Redirect } from "expo-router";
import { ActivityIndicator, StyleSheet, View } from "react-native";

import { GradientBackground } from "@/components/glass";
import { useAuth } from "@/contexts/AuthContext";
import { Colors } from "@/constants/colors";

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
    return <Redirect href="/onboarding" />;
  }

  return <Redirect href="/dashboard" />;
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
});
