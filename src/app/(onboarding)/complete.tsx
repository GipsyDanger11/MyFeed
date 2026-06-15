/**
 * Onboarding step 4 — "All set" confirmation.
 * Persists the topic preferences + marks the profile as onboarded,
 * then redirects to the dashboard.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GlassCard,
  GradientBackground,
  GradientButton,
  GradientText,
} from "@/components/glass";
import { OnboardingDots } from "@/components/onboarding/OnboardingDots";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { markOnboarded, replacePreferences } from "@/lib/db";
import type { TopicDirection } from "@/types/database";

export default function CompleteScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ selection?: string }>();
  const { user, profile, refreshProfile } = useAuth();

  const [saving, setSaving] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      try {
        const raw = params.selection ?? "{}";
        const selection = JSON.parse(raw) as Record<string, TopicDirection>;
        const topics = Object.entries(selection).map(([topic, direction]) => ({
          topic,
          direction,
        }));
        await replacePreferences(user.id, topics);
        await markOnboarded(user.id);
        await refreshProfile();
        setSaving(false);
      } catch (e: unknown) {
        setError(e instanceof Error ? e.message : "Failed to save preferences.");
        setSaving(false);
      }
    })();
  }, [user?.id, params.selection, refreshProfile]);

  return (
    <GradientBackground>
      <View
        style={[
          styles.container,
          { paddingTop: insets.top + Spacing[6], paddingBottom: insets.bottom + Spacing[6] },
        ]}
      >
        <OnboardingDots total={4} current={3} />

        <View style={styles.hero}>
          <LinearGradient
            colors={Gradients.success as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.checkmark}
          >
            <Text style={styles.checkmarkText}>✓</Text>
          </LinearGradient>
          <GradientText
            text="You're all set!"
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={Typography.h1}
          />
          <Text
            style={[
              Typography.body,
              { color: Colors.textMuted, textAlign: "center", maxWidth: 320 },
            ]}
          >
            {saving
              ? "Saving your preferences..."
              : error
                ? error
                : `Welcome, ${profile?.display_name ?? "friend"}. MyFeed will start curating your Instagram feed in the background.`}
          </Text>
        </View>

        <GlassCard padding={5} radius="2xl" style={styles.card}>
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[2] }]}>
            What happens next
          </Text>
          <Bullet emoji="🤖" label="Our worker logs in periodically to like & follow based on your topics." />
          <Bullet emoji="📊" label="Your dashboard shows live progress and activity." />
          <Bullet emoji="⏸️" label="You can pause or change preferences any time in Settings." />
        </GlassCard>

        {saving ? (
          <ActivityIndicator color={Colors.pink} size="large" />
        ) : (
          <GradientButton label="Open dashboard" onPress={() => router.replace("/dashboard")} />
        )}
      </View>
    </GradientBackground>
  );
}

function Bullet({ emoji, label }: { emoji: string; label: string }) {
  return (
    <View style={styles.bullet}>
      <Text style={{ fontSize: 18 }}>{emoji}</Text>
      <Text style={[Typography.body, { color: Colors.text, flex: 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    gap: Spacing[6],
  },
  hero: { alignItems: "center", gap: Spacing[4], marginTop: Spacing[6] },
  checkmark: {
    width: 96,
    height: 96,
    borderRadius: 9999,
    alignItems: "center",
    justifyContent: "center",
  },
  checkmarkText: { color: "#fff", fontSize: 48, fontWeight: "800" },
  card: {},
  bullet: { flexDirection: "row", alignItems: "center", gap: Spacing[3], marginTop: Spacing[2] },
});
