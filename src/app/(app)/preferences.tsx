import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  Chip,
  GradientBackground,
  GradientText,
  StatusPill,
} from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
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
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Failed to save preferences.";
      Alert.alert("Error", msg);
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
        {/* HERO HEADER */}
        <View style={styles.header}>
          <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 2 }]}>
            PREFERENCES
          </Text>
          <GradientText
            text="Tap to boost, tap again to reduce."
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={[Typography.h1, { fontSize: 32, lineHeight: 36, marginTop: 2 }]}
          />
        </View>

        <View style={styles.summary}>
          <StatusPill label={`${boostCount} boost`} variant="success" />
          <StatusPill label={`${reduceCount} reduce`} variant="danger" />
        </View>

        {/* BOOST */}
        <View style={{ gap: Spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={{ fontSize: 14 }}>🌱</Text>
            </View>
            <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
              Topics to boost
            </Text>
          </View>
          <View style={styles.sectionCard}>
            <View style={styles.chipSection}>
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
            </View>
          </View>
        </View>

        {/* REDUCE */}
        <View style={{ gap: Spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={{ fontSize: 14 }}>🚫</Text>
            </View>
            <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
              Topics to reduce
            </Text>
          </View>
          <View style={styles.sectionCard}>
            <View style={styles.chipSection}>
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
            </View>
          </View>
        </View>

        {/* SAVE */}
        <Pressable
          onPress={save}
          disabled={saving || boostCount === 0}
          style={({ pressed }) => [
            styles.saveWrap,
            { opacity: saving || boostCount === 0 ? 0.5 : pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.saveGradient}
          >
            {saving ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <Text style={styles.saveText}>Save preferences</Text>
            )}
          </LinearGradient>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[5], gap: Spacing[6] },
  center: { flex: 1, alignItems: "center", justifyContent: "center" },
  header: { gap: Spacing[1], paddingHorizontal: Spacing[1] },
  summary: { flexDirection: "row", gap: Spacing[2], paddingHorizontal: Spacing[2] },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingHorizontal: Spacing[2],
  },
  sectionIcon: {
    width: 32,
    height: 32,
    borderRadius: Radius["2xl"],
    backgroundColor: Colors.surface,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: Colors.border,
  },
  sectionCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius["5xl"],
    borderWidth: 1,
    borderColor: Colors.border,
    overflow: "hidden",
  },
  chipSection: { padding: Spacing[4] },
  chipRow: { flexDirection: "row", flexWrap: "wrap", gap: Spacing[2] },
  saveWrap: {
    borderRadius: Radius["5xl"],
    overflow: "hidden",
  },
  saveGradient: {
    paddingVertical: Spacing[4],
    alignItems: "center",
    justifyContent: "center",
  },
  saveText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
