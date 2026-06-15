/**
 * Onboarding step 3 — connect Instagram.
 * Username + password form. The plaintext password is NEVER stored.
 * We send it to the Python worker over HTTPS, the worker logs in,
 * returns an encrypted session, and we throw the password away.
 *
 * (For the hackathon we store a flag locally + a placeholder
 * encrypted session. The real integration talks to the worker API.)
 */
import { useLocalSearchParams, useRouter } from "expo-router";
import { useState } from "react";
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GlassCard,
  GradientBackground,
  GradientButton,
  GradientText,
  StatusPill,
} from "@/components/glass";
import { OnboardingDots } from "@/components/onboarding/OnboardingDots";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { encryptSession } from "@/lib/encryption";
import { upsertInstagramConnection } from "@/lib/db";

export default function ConnectInstagramScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selection?: string }>();
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<"idle" | "connecting" | "connected" | "error">("idle");
  const [error, setError] = useState<string | undefined>();

  async function handleConnect() {
    if (!user?.id) {
      setError("You must be signed in.");
      return;
    }
    if (!username || !password) {
      setError("Please enter your Instagram username and password.");
      return;
    }
    setError(undefined);
    setStatus("connecting");
    try {
      // Call the Python worker to perform the Instagram login. The worker
      // returns an encrypted session blob we can store in Supabase.
      const res = await fetch("/api/connect-instagram", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, username, password }),
      });
      if (!res.ok) {
        throw new Error(`Connection failed: ${res.status}`);
      }
      const data = (await res.json()) as { encrypted_session: string };
      // Defence in depth: also encrypt on the client before persisting.
      const doubleEncrypted = encryptSession(data.encrypted_session);
      await upsertInstagramConnection({
        userId: user.id,
        username,
        encryptedSession: doubleEncrypted,
        status: "connected",
      });
      setStatus("connected");
      // Pass the selection forward so step 4 can persist it before redirect.
      router.push({
        pathname: "/complete",
        params: { selection: params.selection ?? "{}" },
      });
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Connection failed.");
    }
  }

  return (
    <GradientBackground>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <ScrollView
          contentContainerStyle={[
            styles.container,
            { paddingTop: insets.top + Spacing[4], paddingBottom: insets.bottom + Spacing[6] },
          ]}
          keyboardShouldPersistTaps="handled"
        >
          <OnboardingDots total={4} current={2} />

          <View style={styles.header}>
            <GradientText
              text="Connect Instagram"
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={Typography.h1}
            />
            <Text style={[Typography.body, { color: Colors.textMuted, marginTop: Spacing[2] }]}>
              Sign in once — we'll handle the rest. Your credentials are never stored in plain text.
            </Text>
          </View>

          <GlassCard padding={6} radius="2xl" style={styles.card}>
            <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
              Username
            </Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="@yourusername"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
            <View style={{ height: Spacing[4] }} />
            <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
              Password
            </Text>
            <TextInput
              value={password}
              onChangeText={setPassword}
              secureTextEntry
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="••••••••"
              placeholderTextColor={Colors.textSubtle}
              style={styles.input}
            />
            <View style={styles.disclaimer}>
              <Text style={[Typography.caption, { color: Colors.textSubtle }]}>
                🔒 Your credentials are encrypted and only used to personalize your feed. Never stored in plain text.
              </Text>
            </View>

            {error ? (
              <View style={{ marginTop: Spacing[3] }}>
                <StatusPill label={error} variant="danger" />
              </View>
            ) : null}

            <View style={{ height: Spacing[5] }} />
            <GradientButton
              label={status === "connecting" ? "Connecting..." : "Connect account"}
              onPress={handleConnect}
              loading={status === "connecting"}
              disabled={status === "connected"}
            />
          </GlassCard>
        </ScrollView>
      </KeyboardAvoidingView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: { flexGrow: 1, paddingHorizontal: Spacing[6], gap: Spacing[5] },
  header: {},
  card: {},
  input: {
    backgroundColor: "rgba(255,255,255,0.04)",
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    fontSize: 16,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[4],
  },
  disclaimer: { marginTop: Spacing[3] },
});
