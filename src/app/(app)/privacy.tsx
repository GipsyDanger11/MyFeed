import { useRouter } from "expo-router";
import { ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { GlassCard, GradientBackground, ScreenHeader } from "@/components/glass";
import { Colors } from "@/constants/colors";
import { Spacing } from "@/constants/spacing";
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
      >
        <ScreenHeader
          title="Privacy"
          subtitle="How MyFeed handles your data."
        />

        <GlassCard padding={5} radius="2xl" style={{ gap: Spacing[3] }}>
          <Heading>What we store</Heading>
          <Bullet label="Your email and display name (from your account)." />
          <Bullet label="Topic preferences (boost / reduce)." />
          <Bullet label="An encrypted Instagram session token — never your password." />
          <Bullet label="An activity log of automation actions for your dashboard." />
        </GlassCard>

        <GlassCard padding={5} radius="2xl" style={{ gap: Spacing[3] }}>
          <Heading>What we never do</Heading>
          <Bullet label="We never sell or share your data with third parties." />
          <Bullet label="We never store your Instagram password in plain text." />
          <Bullet label="We never post, comment, or send DMs on your behalf." />
        </GlassCard>

        <GlassCard padding={5} radius="2xl" style={{ gap: Spacing[3] }}>
          <Heading>Your control</Heading>
          <Bullet label="Pause automation at any time from Settings." />
          <Bullet label="Disconnect your Instagram account with one tap." />
          <Bullet label="Sign out to remove the local session from this device." />
        </GlassCard>

        <Text
          style={[
            Typography.caption,
            { color: Colors.textSubtle, textAlign: "center", marginTop: Spacing[2] },
          ]}
        >
          MyFeed v1.0 · Built for the MyFeed Hackathon Challenge
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

function Heading({ children }: { children: React.ReactNode }) {
  return (
    <Text style={[Typography.h3, { color: Colors.text }]}>{children}</Text>
  );
}

function Bullet({ label }: { label: string }) {
  return (
    <View style={{ flexDirection: "row", gap: Spacing[2] }}>
      <Text style={{ color: Colors.pink }}>•</Text>
      <Text style={[Typography.body, { color: Colors.textMuted, flex: 1 }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[6], gap: Spacing[4] },
});
