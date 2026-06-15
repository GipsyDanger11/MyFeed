/**
 * Login — loud, unambiguous feedback for every outcome.
 *
 * Mirrors the signup screen's status model so both auth surfaces feel the
 * same. Validation errors render as a prominent red banner; unexpected
 * network/auth failures also trigger an Alert.alert so they can't be missed.
 */
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, StyleSheet, Text, View } from "react-native";

import { AuthField, AuthForm } from "@/components/auth/AuthForm";
import { Colors } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | undefined>();
  const [errorMessage, setErrorMessage] = useState<string | undefined>();

  async function handleSignIn() {
    if (!email || !password) {
      setValidationError("Please enter your email and password.");
      return;
    }
    setValidationError(undefined);
    setErrorMessage(undefined);
    try {
      await signIn(email.trim(), password);
      // index.tsx will redirect to /onboarding or /dashboard
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed.";
      setErrorMessage(msg);
      Alert.alert("Sign in failed", msg);
    }
  }

  async function handleGoogle() {
    setErrorMessage(undefined);
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setErrorMessage(msg);
      Alert.alert("Google sign-in failed", msg);
    }
  }

  return (
    <AuthForm
      title="Welcome back"
      subtitle="Sign in to keep your feed personalized."
      cta={loading ? "Signing in..." : "Sign in"}
      loading={loading}
      onSubmit={handleSignIn}
      footerText="New to MyFeed?"
      footerCta="Create an account"
      onFooterPress={() => router.push("/signup")}
      googleLabel="Continue with Google"
      onGoogle={handleGoogle}
    >
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@email.com"
        editable={!loading}
        error={
          validationError && !email
            ? "Email is required."
            : errorMessage && /email/i.test(errorMessage)
              ? errorMessage
              : undefined
        }
      />
      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="••••••••"
        editable={!loading}
        error={validationError && !password ? "Password is required." : undefined}
      />

      {/* LOUD inline error — never silent */}
      {validationError && email && password ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{validationError}</Text>
        </View>
      ) : null}
      {errorMessage ? (
        <View style={styles.errorRow}>
          <Text style={styles.errorIcon}>⚠️</Text>
          <Text style={styles.errorText}>{errorMessage}</Text>
        </View>
      ) : null}
    </AuthForm>
  );
}

const styles = StyleSheet.create({
  errorRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[2],
    backgroundColor: "rgba(239,68,68,0.10)",
    borderColor: "rgba(239,68,68,0.45)",
    borderWidth: 1,
    borderRadius: Radius.xl,
    padding: Spacing[3],
    marginTop: Spacing[1],
    marginBottom: Spacing[3],
  },
  errorIcon: {
    fontSize: 16,
  },
  errorText: {
    ...Typography.caption,
    color: Colors.danger,
    flex: 1,
    fontWeight: "600",
  },
});
