import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert } from "react-native";

import { AuthField, AuthForm } from "@/components/auth/AuthForm";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginScreen() {
  const router = useRouter();
  const { signIn, signInWithGoogle, loading } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | undefined>();

  async function handleSignIn() {
    if (!email || !password) {
      setError("Please enter your email and password.");
      return;
    }
    setError(undefined);
    try {
      await signIn(email.trim(), password);
      // index.tsx will redirect to /onboarding or /dashboard
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign in failed.";
      setError(msg);
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
      title="Welcome back"
      subtitle="Sign in to keep your feed personalized."
      cta="Sign in"
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
        error={error && !email ? "Email is required." : undefined}
      />
      <AuthField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoComplete="current-password"
        placeholder="••••••••"
        error={error && !password ? "Password is required." : undefined}
      />
      {error && email && password ? (
        <AuthField
          label=""
          value=""
          editable={false}
          error={error}
        />
      ) : null}
    </AuthForm>
  );
}
