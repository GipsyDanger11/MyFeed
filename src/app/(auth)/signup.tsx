/**
 * Signup — loud, unambiguous feedback for every outcome.
 *
 * Bug fix: the previous version used `loading` (undefined in this scope) and
 * rendered the "check your email" success state as a red error message.
 *
 * Status model:
 *   idle                  — no submit yet
 *   loading               — submit in flight (spinner in the CTA)
 *   needs_confirmation    — Supabase requires email confirmation; show a
 *                            loud success banner with Resend + Go-to-signin
 *   ready                 — account created and session is live (auto-routes)
 *   error                 — show inline + Alert.alert
 */
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useState } from "react";
import { Alert, Linking, Pressable, StyleSheet, Text, View } from "react-native";

import { AuthField, AuthForm } from "@/components/auth/AuthForm";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/lib/supabase";

type Status =
  | { kind: "idle" }
  | { kind: "loading" }
  | { kind: "needs_confirmation"; email: string }
  | { kind: "error"; message: string };

export default function SignupScreen() {
  const router = useRouter();
  const { signInWithGoogle } = useAuth();
  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [validationError, setValidationError] = useState<string | undefined>();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [resending, setResending] = useState(false);

  async function handleSignUp() {
    if (!email || !password) {
      setValidationError("Please enter your email and password.");
      return;
    }
    if (password.length < 6) {
      setValidationError("Password must be at least 6 characters.");
      return;
    }
    setValidationError(undefined);
    setStatus({ kind: "loading" });
    try {
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim() || email.split("@")[0],
          },
        },
      });
      if (signUpError) {
        const msg = signUpError.message;
        setStatus({ kind: "error", message: msg });
        Alert.alert("Sign up failed", msg);
        return;
      }
      // Email confirmation required — Supabase returns a user but no session.
      if (data.user && !data.session) {
        setStatus({ kind: "needs_confirmation", email: email.trim() });
        Alert.alert(
          "✅ Account created",
          `We sent a confirmation link to ${email.trim()}. Check your inbox (and spam folder), then tap the link to activate.`,
        );
        return;
      }
      // Session is live — write a profile row, then bounce to the index
      // router which will send the user to /onboarding or /dashboard.
      if (data.user) {
        await supabase.from("profiles").upsert(
          {
            id: data.user.id,
            email,
            display_name: displayName.trim() || email.split("@")[0],
            automation_paused: false,
            personalization_score: 0,
          },
          { onConflict: "id", ignoreDuplicates: true },
        );
        setStatus({ kind: "idle" });
        // index.tsx redirects based on auth + onboarded state.
      }
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Sign up failed.";
      setStatus({ kind: "error", message: msg });
      Alert.alert("Sign up failed", msg);
    }
  }

  async function handleResend() {
    if (status.kind !== "needs_confirmation") return;
    setResending(true);
    try {
      const { error: resendError } = await supabase.auth.resend({
        type: "signup",
        email: status.email,
      });
      if (resendError) {
        Alert.alert("Resend failed", resendError.message);
      } else {
        Alert.alert("📧 Email sent", `Fresh link sent to ${status.email}.`);
      }
    } catch (e: unknown) {
      Alert.alert(
        "Resend failed",
        e instanceof Error ? e.message : "Unknown error",
      );
    } finally {
      setResending(false);
    }
  }

  async function openEmailApp() {
    // Best-effort — Linking.openURL silently no-ops on simulators without a
    // mail app, which is fine; the banner still shows the address.
    try {
      await Linking.openURL("mailto:");
    } catch {
      /* no-op */
    }
  }

  async function handleGoogle() {
    setStatus({ kind: "loading" });
    try {
      await signInWithGoogle();
      // index.tsx will redirect; reset in case it doesn't
      setStatus({ kind: "idle" });
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Unknown error";
      setStatus({ kind: "error", message: msg });
      Alert.alert("Google sign-in failed", msg);
    }
  }

  const loading = status.kind === "loading";
  const errorMessage = status.kind === "error" ? status.message : undefined;

  return (
    <AuthForm
      title="Create your account"
      subtitle="One tap to a feed that actually fits you."
      cta={loading ? "Creating account..." : "Create account"}
      loading={loading}
      onSubmit={handleSignUp}
      footerText="Already have an account?"
      footerCta="Sign in"
      onFooterPress={() => router.replace("/login")}
      googleLabel="Continue with Google"
      onGoogle={handleGoogle}
    >
      {/* LOUD success banner — replaces the old red "error" message */}
      {status.kind === "needs_confirmation" ? (
        <View style={styles.banner}>
          <View style={styles.bannerIcon}>
            <LinearGradient
              colors={Gradients.success as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.bannerIconFill}
            >
              <Text style={styles.bannerIconText}>✓</Text>
            </LinearGradient>
          </View>
          <Text style={styles.bannerTitle}>Account created!</Text>
          <Text style={styles.bannerBody}>
            We sent a confirmation link to{"\n"}
            <Text style={styles.bannerEmail}>{status.email}</Text>
          </Text>
          <Text style={styles.bannerHint}>
            Open the email, tap the link, then come back to sign in.
          </Text>
          <View style={styles.bannerButtons}>
            <Pressable
              onPress={handleResend}
              disabled={resending}
              style={({ pressed }) => [
                styles.resendBtn,
                { opacity: resending ? 0.6 : pressed ? 0.8 : 1 },
              ]}
            >
              <Text style={styles.resendText}>
                {resending ? "Sending..." : "Resend email"}
              </Text>
            </Pressable>
            <Pressable
              onPress={() => router.replace("/login")}
              style={({ pressed }) => [
                styles.signinBtn,
                { opacity: pressed ? 0.85 : 1 },
              ]}
            >
              <LinearGradient
                colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.signinGradient}
              >
                <Text style={styles.signinText}>Go to sign in →</Text>
              </LinearGradient>
            </Pressable>
          </View>
          <Pressable onPress={openEmailApp} hitSlop={6}>
            <Text style={styles.openInboxText}>Open email app</Text>
          </Pressable>
        </View>
      ) : null}

      <AuthField
        label="Display name"
        value={displayName}
        onChangeText={setDisplayName}
        autoCapitalize="words"
        placeholder="Alex"
        editable={!loading}
      />
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
        autoComplete="new-password"
        placeholder="At least 6 characters"
        editable={!loading}
        error={
          validationError && password && password.length < 6
            ? "Password must be at least 6 characters."
            : undefined
        }
      />

      {/* LOUD inline error — never silent, never confusingly green */}
      {validationError && email && password.length >= 6 ? (
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
  banner: {
    backgroundColor: "rgba(34,197,94,0.10)",
    borderColor: "rgba(34,197,94,0.45)",
    borderWidth: 1,
    borderRadius: Radius["2xl"],
    padding: Spacing[5],
    marginBottom: Spacing[5],
    alignItems: "center",
    gap: Spacing[2],
  },
  bannerIcon: {
    marginBottom: Spacing[1],
  },
  bannerIconFill: {
    width: 56,
    height: 56,
    borderRadius: 4,
    alignItems: "center",
    justifyContent: "center",
  },
  bannerIconText: {
    color: "#fff",
    fontSize: 28,
    fontWeight: "800",
  },
  bannerTitle: {
    ...Typography.h3,
    color: Colors.success,
    textAlign: "center",
  },
  bannerBody: {
    ...Typography.body,
    color: Colors.text,
    textAlign: "center",
    lineHeight: 22,
  },
  bannerEmail: {
    fontWeight: "700",
    color: Colors.text,
  },
  bannerHint: {
    ...Typography.caption,
    color: Colors.textMuted,
    textAlign: "center",
    marginTop: Spacing[1],
  },
  bannerButtons: {
    flexDirection: "row",
    gap: Spacing[2],
    marginTop: Spacing[3],
    width: "100%",
  },
  resendBtn: {
    flex: 1,
    paddingVertical: Spacing[3],
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    backgroundColor: Colors.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  resendText: {
    ...Typography.smallBold,
    color: Colors.text,
  },
  signinBtn: {
    flex: 1,
    borderRadius: Radius.xl,
    overflow: "hidden",
  },
  signinGradient: {
    paddingVertical: Spacing[3],
    alignItems: "center",
    justifyContent: "center",
  },
  signinText: {
    ...Typography.smallBold,
    color: "#fff",
  },
  openInboxText: {
    ...Typography.caption,
    color: Colors.pink,
    marginTop: Spacing[2],
    textDecorationLine: "underline",
  },
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
