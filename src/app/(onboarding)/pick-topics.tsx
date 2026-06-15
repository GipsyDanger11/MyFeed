/**
 * Onboarding step 2 — preference selection.
 * Two sections: boost (green) and reduce (red). Multi-select chips.
 * At least one boost topic is required to continue.
 *
 * Includes a Groq-powered "Describe what you love" input that suggests
 * topics to boost based on a free-form description.
 */
import { useRouter } from "expo-router";
import { useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { Chip, GlassCard, GradientBackground, GradientButton, GradientText, StatusPill } from "@/components/glass";
import { OnboardingDots } from "@/components/onboarding/OnboardingDots";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { TOPICS, TopicDirection } from "@/constants/topics";
import { Typography } from "@/constants/typography";
import { isGroqConfigured, suggestTopics } from "@/lib/groq";

type Selection = Record<string, TopicDirection>;

export default function PreferencesScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [selection, setSelection] = useState<Selection>({});
  const [aiInput, setAiInput] = useState("");
  const [aiLoading, setAiLoading] = useState(false);
  const aiEnabled = isGroqConfigured();

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

  async function handleSuggest() {
    if (!aiInput.trim()) return;
    setAiLoading(true);
    try {
      const suggested = await suggestTopics(aiInput);
      if (suggested.length === 0) {
        Alert.alert("No matches", "We couldn't pick a topic from that. Try a different description.");
        return;
      }
      // Map each suggested label to its topic id, then set as "boost" unless
      // the user already marked it as "reduce".
      const labelToId = new Map(TOPICS.map((t) => [t.label, t.id]));
      let added = 0;
      setSelection((prev) => {
        const next = { ...prev };
        for (const label of suggested) {
          const id = labelToId.get(label);
          if (!id) continue;
          if (next[id] === "reduce") continue; // user explicitly reduced it
          if (next[id] === "boost") continue;
          next[id] = "boost";
          added++;
        }
        return next;
      });
      Alert.alert(
        "✨ Suggested",
        added > 0
          ? `Boosted ${added} topic${added === 1 ? "" : "s"}. You can still adjust below.`
          : "Those topics are already set. Adjust them below.",
      );
    } catch {
      Alert.alert("Suggestions unavailable", "AI is offline — pick topics manually below.");
    } finally {
      setAiLoading(false);
    }
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

        {aiEnabled ? (
          <GlassCard padding={4} radius="2xl" style={styles.aiCard}>
            <Text style={[Typography.smallBold, { color: Colors.pink, letterSpacing: 1, textTransform: "uppercase" }]}>
              ✨ AI assist
            </Text>
            <Text style={[Typography.body, { color: Colors.text, marginTop: 4 }]}>
              Describe what you love
            </Text>
            <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
              e.g. "Elon Musk, SpaceX, and coding"
            </Text>
            <View style={styles.aiInputRow}>
              <TextInput
                value={aiInput}
                onChangeText={setAiInput}
                placeholder="What are you into?"
                placeholderTextColor={Colors.textSubtle}
                style={styles.aiInput}
                editable={!aiLoading}
                onSubmitEditing={handleSuggest}
                returnKeyType="send"
              />
              <Pressable
                onPress={handleSuggest}
                disabled={aiLoading || !aiInput.trim()}
                style={({ pressed }) => [
                  styles.aiBtn,
                  {
                    opacity: aiLoading || !aiInput.trim() ? 0.5 : pressed ? 0.85 : 1,
                  },
                ]}
              >
                {aiLoading ? (
                  <ActivityIndicator color="#fff" size="small" />
                ) : (
                  <Text style={styles.aiBtnText}>Suggest</Text>
                )}
              </Pressable>
            </View>
          </GlassCard>
        ) : null}

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
          label={
            boostCount === 0
              ? "Pick at least one topic to continue"
              : `Continue with ${boostCount} boost${boostCount === 1 ? "" : "s"}`
          }
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
  aiCard: { gap: Spacing[1] },
  aiInputRow: {
    flexDirection: "row",
    gap: Spacing[2],
    marginTop: Spacing[3],
  },
  aiInput: {
    flex: 1,
    backgroundColor: "rgba(255,255,255,0.05)",
    borderRadius: Radius.none,
    borderWidth: 1,
    borderColor: Colors.border,
    color: Colors.text,
    paddingHorizontal: Spacing[4],
    paddingVertical: Spacing[3],
    fontSize: 14,
  },
  aiBtn: {
    paddingHorizontal: Spacing[5],
    backgroundColor: Colors.pink,
    borderRadius: Radius.none,
    alignItems: "center",
    justifyContent: "center",
    minWidth: 92,
  },
  aiBtnText: {
    color: "#fff",
    fontWeight: "700",
    fontSize: 14,
    letterSpacing: 0.3,
  },
});
