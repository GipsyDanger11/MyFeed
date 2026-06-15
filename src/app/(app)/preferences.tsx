/**
 * Edit preferences (post-onboarding) — reuses the chip layout from onboarding.
 * Loads the current selection from Supabase, lets the user change it, and saves.
 */
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Chip,
  GlassCard,
  GradientBackground,
  GradientButton,
  ScreenHeader,
  StatusPill,
} from "@/components/glass";
import { Colors } from "@/constants/colors";
import { Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { getPreferences, replacePreferences } from "@/lib/db";
import { TOPICS, TopicDirection } from "@/constants/topics";

type Selection = Record<string, TopicDirection>;

export default function PreferencesEditScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selection, setSelection] = useState<Selection>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      if (!user?.id) return;
      const prefs = await getPreferences(user.id);
      const sel: Selection = {};
      for (const p of prefs) sel[p.topic] = p.direction;
      setSelection(sel);
      setLoading(false);
    })();
  }, [user?.id]);

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
      if (next[id] === dir) delete next[id];
      else next[id] = dir;
      return next;
    });
  }

  async function save() {
    if (!user?.id) return;
    setSaving(true);
    try {
      await replacePreferences(
        user.id,
        Object.entries(selection).map(([topic, direction]) => ({ topic, direction })),
      );
      router.back();
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <GradientBackground>
        <View style={[styles.center, { paddingTop: insets.top }]}>
          <ActivityIndicator color={Colors.pink} size="large" />
        </View>
      </GradientBackground>
    );
  }

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing[2], paddingBottom: insets.bottom + Spacing[10] },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <ScreenHeader
          title="Preferences"
          subtitle="Tap to boost, tap again to reduce."
        />
        <View style={styles.summary}>
          <StatusPill label={`${boostCount} boost`} variant="success" />
          <StatusPill label={`${reduceCount} reduce`} variant="danger" />
        </View>

        <GlassCard padding={5} radius="2xl">
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[3] }]}>
            🌱 Topics to boost
          </Text>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => (
              <Chip
                key={`b-${t.id}`}
                label={t.label}
                emoji={t.emoji}
                selected={selection[t.id] === "boost"}
                variant="boost"
                onPress={() => setTopic(t.id, "boost")}
              />
            ))}
          </View>
        </GlassCard>

        <GlassCard padding={5} radius="2xl">
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[3] }]}>
            🚫 Topics to reduce
          </Text>
          <View style={styles.chipRow}>
            {TOPICS.map((t) => (
              <Chip
                key={`r-${t.id}`}
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
          label={saving ? "Saving..." : "Save preferences"}
          onPress={save}
          loading={saving}
          disabled={boostCount === 0}
        />
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[6], gap: Spacing[4] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  summary: { flexDirection: "row", gap: Spacing[2] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
});
