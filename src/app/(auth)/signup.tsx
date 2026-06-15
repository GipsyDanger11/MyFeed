import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { AuthField, AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/contexts/AuthContext";

export default function SignupScreen() {
  const router = useRouter();
  const { signUp, signInWithGoogle, loading } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function handleSignUp() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }
    setError(undefined);
    try {
      await signUp(email.trim(), password, displayName.trim() || undefined);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Sign up failed.");
    }
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
    } catch (e: unknown) {
      Alert.alert("Google sign-in failed", e instanceof Error ? e.message : "Unknown error");
    }
  }

  return (
    <AuthForm
      title="Create your account"
      subtitle="One tap to a feed that actually fits you."
      cta="Create account"
      loading={loading}
      onSubmit={handleSignUp}
      footerText="Already have an account?"
      footerCta="Sign in"
      onFooterPress={() => router.back()}
      googleLabel="Continue with Google"
      onGoogle={handleGoogle}
    >
      <AuthField
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        placeholder="Alex"
      />
      <AuthField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoComplete="email"
        placeholder="you@email.com"
        error={error && !email ? "Email is required." : undefined}
      />
      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="new-password"
        placeholder="At least 6 characters"
        error={
          error && password && password.length < 6
            ? "Password must be at least 6 characters."
            : undefined
        }
      />
      {error && email && password.length >= 6 ? (
        <AuthField label="" value="" editable={false} error={error} />
      ) : null}
    </AuthForm>
  );
}
