/**
 * Settings — list of management options: edit profile, preferences,
 * pause automation, disconnect Instagram, privacy, sign out.
 */
import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  Alert,
  Pressable,
  ScrollView,
  StyleSheet,
  Switch,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  GlassCard,
  GradientBackground,
  ScreenHeader,
} from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import {
  deleteInstagramConnection,
  getInstagramConnection,
  setAutomationPaused,
} from "@/lib/db";
import type { InstagramConnection } from "@/types/database";

export default function SettingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, signOut, refreshProfile } = useAuth();
  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [toggling, setToggling] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    const c = await getInstagramConnection(user.id);
    setConnection(c);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  const paused = !!profile?.automation_paused;

  async function onTogglePaused(next: boolean) {
    if (!user?.id) return;
    setToggling(true);
    try {
      await setAutomationPaused(user.id, next);
      await refreshProfile();
    } finally {
      setToggling(false);
    }
  }

  function onDisconnectInstagram() {
    Alert.alert(
      "Disconnect Instagram?",
      "This will stop automation. You can reconnect any time.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Disconnect",
          style: "destructive",
          onPress: async () => {
            if (!user?.id) return;
            await deleteInstagramConnection(user.id);
            await load();
          },
        },
      ],
    );
  }

  function onSignOut() {
    Alert.alert("Sign out?", "You can sign back in any time.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void signOut() },
    ]);
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
          title="Settings"
          subtitle="Manage your MyFeed account and preferences."
        />

        <Section title="Profile">
          <Row label="Display name" value={profile?.display_name ?? "—"} />
          <Row label="Email" value={profile?.email ?? user?.email ?? "—"} />
        </Section>

        <Section title="Automation">
          <ToggleRow
            label="Pause automation"
            description="Stop all background activity. You can resume any time."
            value={paused}
            onChange={onTogglePaused}
            disabled={toggling}
          />
          <PressableRow
            label="Edit preferences"
            description="Update topics you want to boost or reduce."
            onPress={() => router.push("/preferences")}
          />
        </Section>

        <Section title="Instagram">
          <Row
            label="Account"
            value={connection?.username ? `@${connection.username}` : "Not connected"}
          />
          <Row
            label="Status"
            value={
              connection?.status
                ? connection.status.charAt(0).toUpperCase() + connection.status.slice(1)
                : "Disconnected"
            }
          />
          {connection ? (
            <PressableRow
              label="Disconnect account"
              description="Removes your encrypted session from MyFeed."
              onPress={onDisconnectInstagram}
              destructive
            />
          ) : null}
        </Section>

        <Section title="App">
          <PressableRow
            label="Privacy policy"
            description="How MyFeed handles your data."
            onPress={() => router.push("/privacy")}
          />
          <Row label="Version" value={String(Constants.expoConfig?.version ?? "1.0.0")} />
        </Section>

        <View style={{ height: Spacing[6] }} />
        <Pressable
          onPress={onSignOut}
          style={({ pressed }) => [
            styles.signOut,
            { opacity: pressed ? 0.7 : 1 },
          ]}
        >
          <Text style={[Typography.bodyBold, { color: Colors.danger }]}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </GradientBackground>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ gap: Spacing[2] }}>
      <Text
        style={[
          Typography.smallBold,
          { color: Colors.textMuted, textTransform: "uppercase", paddingHorizontal: Spacing[2] },
        ]}
      >
        {title}
      </Text>
      <GlassCard padding={4} radius="2xl">
        {children}
      </GlassCard>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <Text style={[Typography.body, { color: Colors.textMuted }]}>{label}</Text>
      <Text style={[Typography.bodyBold, { color: Colors.text }]} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

function ToggleRow({
  label,
  description,
  value,
  onChange,
  disabled,
}: {
  label: string;
  description: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={{ flex: 1, paddingRight: Spacing[3] }}>
        <Text style={[Typography.bodyBold, { color: Colors.text }]}>{label}</Text>
        {description ? (
          <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Switch
        value={value}
        onValueChange={onChange}
        disabled={disabled}
        trackColor={{ false: Colors.surfaceStrong, true: Colors.purple }}
        thumbColor="#fff"
      />
    </View>
  );
}

function PressableRow({
  label,
  description,
  onPress,
  destructive = false,
}: {
  label: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable onPress={onPress} style={({ pressed }) => [styles.row, { opacity: pressed ? 0.6 : 1 }]}>
      <View style={{ flex: 1, paddingRight: Spacing[3] }}>
        <Text
          style={[
            Typography.bodyBold,
            { color: destructive ? Colors.danger : Colors.text },
          ]}
        >
          {label}
        </Text>
        {description ? (
          <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <Text style={{ color: Colors.textSubtle, fontSize: 18 }}>›</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[6], gap: Spacing[5] },
  row: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  signOut: {
    alignSelf: "center",
    paddingHorizontal: Spacing[6],
    paddingVertical: Spacing[4],
    borderRadius: Radius.xl,
    borderWidth: 1,
    borderColor: Colors.danger,
  },
});
