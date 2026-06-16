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
import { upsertInstagramConnection } from "@/lib/db";
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  automationApiUrl?: string;
};
const API_URL = extra.automationApiUrl ?? "http://localhost:8000";

export default function ConnectInstagramScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selection?: string }>();
  const { user } = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [code, setCode] = useState("");
  const [sessionid, setSessionid] = useState("");
  const [dsUserId, setDsUserId] = useState("");
  const [csrftoken, setCsrftoken] = useState("");
  const [importMode, setImportMode] = useState(false);
  const [challengeState, setChallengeState] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "sending_code" | "connected" | "error" | "resolving">("idle");
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
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${API_URL}/connect-instagram`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ user_id: user.id, username, password }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (data?.challenge_required) {
        setChallengeState(data.challenge_state);
        // Auto-trigger the verification code email
        sendChallengeCode(data.challenge_state);
        return;
      }
      if (!res.ok) {
        const detail = data?.detail ?? res.statusText ?? `Connection failed: ${res.status}`;
        throw new Error(detail);
      }
      await upsertInstagramConnection({
        userId: user.id,
        username,
        encryptedSession: data.encrypted_session,
        status: "connected",
      });
      setStatus("connected");
      router.push({
        pathname: "/complete",
        params: { selection: params.selection ?? "{}" },
      });
    } catch (e: unknown) {
      setStatus("error");
      setError(e instanceof Error ? e.message : "Connection failed.");
    }
  }

  async function sendChallengeCode(currentState: string) {
    if (!user?.id) return;
    setStatus("sending_code");
    setError("Instagram sent a security code. Check your email/SMS and enter it below.");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_URL}/send-challenge-code`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          username,
          password,
          challenge_state: currentState,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (res.ok && data?.challenge_state) {
        setChallengeState(data.challenge_state);
        setStatus("idle");
      } else {
        setError(data?.detail ?? "Failed to send verification code. Try again.");
        setStatus("idle");
      }
    } catch {
      setError("Could not contact the verification server. Try again.");
      setStatus("idle");
    }
  }

  async function handleResolveChallenge() {
    if (!user?.id || !challengeState || !code) {
      setError("Enter the code from your email or SMS.");
      return;
    }
    setError(undefined);
    setStatus("resolving");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120000);
      const res = await fetch(`${API_URL}/resolve-challenge`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          username,
          password,
          challenge_state: challengeState,
          code,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail ?? res.statusText ?? `Verification failed: ${res.status}`;
        throw new Error(detail);
      }
      await upsertInstagramConnection({
        userId: user.id,
        username,
        encryptedSession: data.encrypted_session,
        status: "connected",
      });
      setStatus("connected");
      router.push({
        pathname: "/complete",
        params: { selection: params.selection ?? "{}" },
      });
    } catch (e: unknown) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Verification failed.");
    }
  }

  async function handleImport() {
    if (!user?.id || !sessionid || !dsUserId) {
      setError("Enter your Instagram cookies from the browser.");
      return;
    }
    setError(undefined);
    setStatus("connecting");
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 30000);
      const res = await fetch(`${API_URL}/import-session`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: user.id,
          username: username || "imported",
          sessionid,
          ds_user_id: dsUserId,
          csrftoken,
        }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        const detail = data?.detail ?? res.statusText ?? `Import failed: ${res.status}`;
        throw new Error(detail);
      }
      setStatus("connected");
    } catch (e: unknown) {
      setStatus("idle");
      setError(e instanceof Error ? e.message : "Import failed.");
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
              text={challengeState ? "Enter Security Code" : "Connect Instagram"}
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={Typography.h1}
            />
            <Text style={[Typography.body, { color: Colors.textMuted, marginTop: Spacing[2] }]}>
              {challengeState
                ? "Instagram sent a verification code to your email or phone. Enter it below to continue."
                : "Sign in once — we'll handle the rest. Your credentials are never stored in plain text."}
            </Text>
          </View>

          <GlassCard padding={6} radius="2xl" style={styles.card}>
            {challengeState ? (
              <>
                <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
                  Security Code
                </Text>
                <TextInput
                  value={code}
                  onChangeText={setCode}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="000000"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.input}
                  keyboardType="number-pad"
                  maxLength={8}
                />
              </>
            ) : importMode ? (
              <>
                <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
                  Session ID
                </Text>
                <TextInput
                  value={sessionid}
                  onChangeText={setSessionid}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="sessionid cookie value"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.input}
                />
                <View style={{ height: Spacing[4] }} />
                <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
                  User ID
                </Text>
                <TextInput
                  value={dsUserId}
                  onChangeText={setDsUserId}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="ds_user_id cookie value"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.input}
                />
                <View style={{ height: Spacing[4] }} />
                <Text style={[Typography.smallBold, { color: Colors.textMuted, marginBottom: Spacing[2] }]}>
                  CSRF Token (optional)
                </Text>
                <TextInput
                  value={csrftoken}
                  onChangeText={setCsrftoken}
                  autoCapitalize="none"
                  autoCorrect={false}
                  placeholder="csrftoken cookie value"
                  placeholderTextColor={Colors.textSubtle}
                  style={styles.input}
                />
              </>
            ) : (
              <>
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
              </>
            )}

            <View style={styles.disclaimer}>
              <Text style={[Typography.caption, { color: Colors.textSubtle }]}>
                {challengeState
                  ? "Check your email inbox (and spam) for a code from Instagram."
                  : importMode
                    ? "Paste cookies from your browser's DevTools → Application → Cookies → instagram.com"
                    : "🔒 Your credentials are encrypted and only used to personalize your feed."}
              </Text>
            </View>

            {!challengeState && (
              <Text
                style={[Typography.smallBold, { color: Colors.accent, textAlign: "center", marginTop: Spacing[3], textDecorationLine: "underline" }]}
                onPress={() => { setImportMode(!importMode); setError(undefined); }}
              >
                {importMode ? "Switch to login" : "Login not working? Import session from browser"}
              </Text>
            )}

            {error ? (
              <View style={{ marginTop: Spacing[3] }}>
                <StatusPill label={error} variant="danger" />
              </View>
            ) : null}

            <View style={{ height: Spacing[5] }} />
            <GradientButton
              label={
                status === "connecting"
                  ? importMode ? "Importing..." : "Connecting..."
                  : status === "sending_code"
                    ? "Sending code..."
                    : status === "resolving"
                      ? "Verifying..."
                      : challengeState
                        ? "Verify code"
                        : importMode
                          ? "Import session"
                          : "Connect account"
              }
              onPress={challengeState ? handleResolveChallenge : importMode ? handleImport : handleConnect}
              loading={status === "connecting" || status === "sending_code" || status === "resolving"}
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
