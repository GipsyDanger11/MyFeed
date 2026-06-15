/**
 * Onboarding step 1 — splash / hero.
 * Big gradient logo, app name, tagline, value props and "Get started" CTA.
 */
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { StyleSheet, Text, View } from "react-native";
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

const VALUE_PROPS = [
  { emoji: "🔗", label: "Connect your Instagram account" },
  { emoji: "🎯", label: "Choose what content you want to see more of" },
  { emoji: "✨", label: "Activate personalization" },
  { emoji: "📈", label: "Improve your feed over time" },
];

export default function OnboardingIntro() {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing[6], paddingBottom: insets.bottom + Spacing[6] }]}>
        <OnboardingDots total={4} current={0} />

        <View style={styles.hero}>
          <LinearGradient
            colors={Gradients.hero as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.logoMark}
          >
            <Text style={styles.logoText}>M</Text>
          </LinearGradient>
          <GradientText
            text="MyFeed"
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={[Typography.display, { fontSize: 48, lineHeight: 52 }]}
          />
          <Text style={[Typography.body, { color: Colors.textMuted, textAlign: "center", maxWidth: 320 }]}>
            Take control of your Instagram feed. Personalize it with the topics you actually care about.
          </Text>
        </View>

        <View style={styles.list}>
          {VALUE_PROPS.map((p) => (
            <GlassCard key={p.label} padding={4} radius="xl" style={styles.row}>
              <Text style={styles.emoji}>{p.emoji}</Text>
              <Text style={[Typography.bodyBold, { color: Colors.text, flex: 1 }]}>{p.label}</Text>
            </GlassCard>
          ))}
        </View>

        <GradientButton label="Get started" onPress={() => router.push("/preferences")} />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    gap: Spacing[6],
  },
  hero: {
    alignItems: "center",
    gap: Spacing[4],
    marginTop: Spacing[6],
  },
  logoMark: {
    width: 84,
    height: 84,
    borderRadius: Radius["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  logoText: { color: "#fff", fontSize: 40, fontWeight: "800" },
  list: { gap: Spacing[3] },
  row: { flexDirection: "row", alignItems: "center", gap: Spacing[3] },
  emoji: { fontSize: 20 },
});
