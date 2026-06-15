import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GradientBackground, GradientText } from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";

export default function PrivacyScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();

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
            PRIVACY
          </Text>
          <GradientText
            text="How MyFeed handles your data."
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={[Typography.h1, { fontSize: 32, lineHeight: 36, marginTop: 2 }]}
          />
        </View>

        {/* WHAT WE STORE */}
        <View style={{ gap: Spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={{ fontSize: 14 }}>🛡</Text>
            </View>
            <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
              What we store
            </Text>
          </View>
          <View style={styles.sectionCard}>
            <Bullet icon="📧" label="Your email and display name (from your account)." />
            <Bullet icon="🎯" label="Topic preferences (boost / reduce)." />
            <Bullet icon="🔐" label="An encrypted Instagram session token — never your password." />
            <Bullet icon="📋" label="An activity log of automation actions for your dashboard." last />
          </View>
        </View>

        {/* WHAT WE NEVER DO */}
        <View style={{ gap: Spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={{ fontSize: 14 }}>🚫</Text>
            </View>
            <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
              What we never do
            </Text>
          </View>
          <View style={styles.sectionCard}>
            <Bullet icon="📤" label="We never sell or share your data with third parties." />
            <Bullet icon="🔑" label="We never store your Instagram password in plain text." />
            <Bullet icon="🤖" label="We never post, comment, or send DMs on your behalf." last />
          </View>
        </View>

        {/* YOUR CONTROL */}
        <View style={{ gap: Spacing[3] }}>
          <View style={styles.sectionHeader}>
            <View style={styles.sectionIcon}>
              <Text style={{ fontSize: 14 }}>🎛</Text>
            </View>
            <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
              Your control
            </Text>
          </View>
          <View style={styles.sectionCard}>
            <Bullet icon="⏸" label="Pause automation at any time from Settings." />
            <Bullet icon="🔌" label="Disconnect your Instagram account with one tap." />
            <Bullet icon="🚪" label="Sign out to remove the local session from this device." last />
          </View>
        </View>

        {/* BACK BUTTON */}
        <Pressable
          onPress={() => router.back()}
          style={({ pressed }) => [styles.backWrap, { opacity: pressed ? 0.7 : 1 }]}
        >
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.backGradient}
          >
            <Text style={styles.backText}>← Back to Settings</Text>
          </LinearGradient>
        </Pressable>

        <Text
          style={[
            Typography.caption,
            { color: Colors.textSubtle, textAlign: "center", marginTop: Spacing[3] },
          ]}
        >
          MyFeed v1.0 · Built for the MyFeed Hackathon Challenge
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

function Bullet({
  icon,
  label,
  last = false,
}: {
  icon: string;
  label: string;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && { borderBottomWidth: 0 }]}>
      <View style={[styles.iconTile, { backgroundColor: "rgba(255, 79, 182, 0.15)" }]}>
        <Text style={{ fontSize: 14 }}>{icon}</Text>
      </View>
      <Text style={[Typography.body, { color: Colors.textMuted, flex: 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[5], gap: Spacing[6] },
  header: { gap: Spacing[1], paddingHorizontal: Spacing[1] },
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
  row: {
    flexDirection: "row",
    alignItems: "center",
    padding: Spacing[4],
    gap: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  iconTile: {
    width: 36,
    height: 36,
    borderRadius: Radius["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  backWrap: {
    borderRadius: Radius["5xl"],
    overflow: "hidden",
  },
  backGradient: {
    paddingVertical: Spacing[4],
    alignItems: "center",
    justifyContent: "center",
  },
  backText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: 0.3,
  },
});
