/**
 * Onboarding step 2 — preference selection.
 * Two sections: boost (green) and reduce (red). Multi-select chips.
 * At least one boost topic is required to continue.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, GlassCard, GradientBackground, GradientButton, GradientText, StatusPill } from "@/components/glass";
import { OnboardingDots } from "@/components/onboarding/OnboardingDots";
import { Colors, Gradients } from "@/constants/colors";
import { Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { TOPICS, TopicDirection } from "@/constants/topics";

type Selection = Record<string, TopicDirection>;

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection>({});

  const { boostCount, reduceCount } = useMemo(() => {
    let boost = 0;
    let reduce = 0;
    for (const v of Object.values(selection)) {
      if (v === "boost") boost++;
      else if (v === "reduce") reduce++;
    }
    return { boostCount: boost, reduceCount: reduce };
  }, [selection]);

  function setTopic(id: string, dir: TopicDirection) {
    setSelection((prev) => {
      const next = { ...prev };
      if (next[id] === dir) {
        delete next[id];
      } else {
        next[id] = dir;
      }
      return next;
    });
  }

  return (
    <GradientBackground>
      <View style={[styles.container, { paddingTop: insets.top + Spacing[4], paddingBottom: insets.bottom + Spacing[4] }]}>
        <OnboardingDots total={4} current={1} />

        <View style={styles.header}>
          <GradientText
            text="Pick your interests"
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={Typography.h1}
          />
          <Text style={[Typography.body, { color: Colors.textMuted, marginTop: Spacing[2] }]}>
            Tap once for topics to boost, twice to reduce them.
          </Text>
          <View style={styles.summary}>
            <StatusPill label={`${boostCount} boost`} variant="success" />
            <StatusPill label={`${reduceCount} reduce`} variant="danger" />
          </View>
        </View>

        <GlassCard padding={5} radius="2xl" style={styles.card}>
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[3] }]}>
            🌱 Topics to boost
          </Text>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => (
              <Chip
                key={`boost-${t.id}`}
                label={t.label}
                emoji={t.emoji}
                selected={selection[t.id] === "boost"}
                variant="boost"
                onPress={() => setTopic(t.id, "boost")}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={5} radius="2xl" style={styles.card}>
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[3] }]}>
            🚫 Topics to reduce
          </Text>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => (
              <Chip
                key={`reduce-${t.id}`}
                label={t.label}
                emoji={t.emoji}
                selected={selection[t.id] === "reduce"}
                variant="reduce"
                onPress={() => setTopic(t.id, "reduce")}
              />
            ))}
          </View>
        </GlassCard>

        <GradientButton
          label="Continue"
          onPress={() =>
            router.push({
              pathname: "/connect-instagram",
              params: { selection: JSON.stringify(selection) },
            })
          }
          disabled={boostCount === 0}
        />
      </View>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    paddingHorizontal: Spacing[6],
    gap: Spacing[4],
  },
  header: { gap: Spacing[1] },
  summary: { flexDirection: "row", gap: Spacing[2], marginTop: Spacing[3] },
  card: {},
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
});
