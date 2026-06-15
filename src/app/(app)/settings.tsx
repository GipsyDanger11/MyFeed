/**
 * Settings — elegantly redesigned: a large gradient profile hero at the
 * top, followed by rounded section cards with icon-prefixed rows.
 *
 * All functionality is preserved from the previous version:
 *  - profile display
 *  - pause/resume automation toggle
 *  - edit preferences (→ /preferences)
 *  - show Instagram connection + status
 *  - disconnect Instagram with confirmation
 *  - privacy policy (→ /privacy)
 *  - app version
 *  - sign out with confirmation
 *
 * Visual changes vs the previous flat list:
 *  - profile hero: gradient-bordered card with avatar, name, email, status
 *  - section cards: 20px rounded corners (curve borders)
 *  - rows: optional icon in a small rounded square, title/description
 *    on the left, right-side action (value / switch / chevron)
 *  - destructive actions get a small red icon tile
 *  - sign-out is a full-width gradient-stroked danger button
 *  - colour palette is unchanged (purple → pink gradient, dark base)
 */
import Constants from "expo-constants";
import { LinearGradient } from "expo-linear-gradient";
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
    GradientBackground,
    GradientText,
    StatusPill
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
  const displayName = profile?.display_name ?? "Friend";
  const email = profile?.email ?? user?.email ?? "";
  const initial = (displayName || email || "U").charAt(0).toUpperCase();

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
          {
            paddingTop: insets.top + Spacing[2],
            paddingBottom: insets.bottom + Spacing[10],
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {/* HERO HEADER */}
        <View style={styles.header}>
          <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 2 }]}>
            SETTINGS
          </Text>
          <GradientText
            text="Your account"
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            style={[Typography.h1, { fontSize: 32, lineHeight: 36, marginTop: 2 }]}
          />
        </View>

        {/* PROFILE HERO CARD */}
        <View style={styles.heroWrap}>
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroGradient}
          >
            <View style={styles.heroInner}>
              <View style={styles.avatarOuter}>
                <LinearGradient
                  colors={
                    ["#ffffff", "rgba(255,255,255,0.2)"] as unknown as readonly [
                      string,
                      string,
                      ...string[]
                    ]
                  }
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.avatarRing}
                >
                  <View style={styles.avatarInner}>
                    <Text style={styles.avatarText}>{initial}</Text>
                  </View>
                </LinearGradient>
              </View>
              <View style={{ flex: 1, gap: 4 }}>
                <Text
                  style={[Typography.h2, { color: "#fff", fontSize: 20, lineHeight: 24 }]}
                  numberOfLines={1}
                >
                  {displayName}
                </Text>
                <Text
                  style={[Typography.caption, { color: "rgba(255,255,255,0.78)" }]}
                  numberOfLines={1}
                >
                  {email || "—"}
                </Text>
                <View style={{ flexDirection: "row", gap: Spacing[2], marginTop: Spacing[2] }}>
                  <StatusPill
                    label={paused ? "Automation paused" : "Automation active"}
                    variant={paused ? "warning" : "success"}
                    invert
                  />
                </View>
              </View>
            </View>
          </LinearGradient>
        </View>

        {/* AUTOMATION */}
        <Section
          title="Automation"
          subtitle="Decide when MyFeed works for you."
          icon="⚡"
        >
          <ToggleRow
            icon="⏸"
            iconBg="rgba(245, 158, 11, 0.18)"
            iconColor={Colors.warning}
            title="Pause automation"
            description="Stop all background activity. Resume any time."
            value={paused}
            onChange={onTogglePaused}
            disabled={toggling}
          />
          <NavRow
            icon="🎯"
            iconBg="rgba(139, 92, 246, 0.20)"
            iconColor={Colors.purple}
            title="Edit preferences"
            description="Update the topics you want to boost or reduce."
            onPress={() => router.push("/preferences")}
          />
        </Section>

        {/* INSTAGRAM */}
        <Section
          title="Instagram"
          subtitle="Manage your connected account."
          icon="📷"
        >
          <InfoRow
            icon="👤"
            iconBg="rgba(236, 72, 153, 0.18)"
            iconColor={Colors.pink}
            title="Account"
            value={connection?.username ? `@${connection.username}` : "Not connected"}
          />
          <InfoRow
            icon="📡"
            iconBg="rgba(34, 197, 94, 0.18)"
            iconColor={Colors.success}
            title="Status"
            value={
              connection?.status
                ? connection.status.charAt(0).toUpperCase() + connection.status.slice(1)
                : "Disconnected"
            }
            valueColor={
              connection?.status === "connected"
                ? Colors.success
                : connection?.status === "error"
                  ? Colors.danger
                  : Colors.text
            }
            valueDot={
              connection?.status === "connected"
                ? Colors.success
                : connection?.status === "error"
                  ? Colors.danger
                  : Colors.warning
            }
          />
          {connection ? (
            <NavRow
              icon="🔌"
              iconBg="rgba(239, 68, 68, 0.18)"
              iconColor={Colors.danger}
              title="Disconnect account"
              description="Removes the encrypted session from this device."
              onPress={onDisconnectInstagram}
              destructive
            />
          ) : (
            <NavRow
              icon="🔌"
              iconBg="rgba(139, 92, 246, 0.20)"
              iconColor={Colors.purple}
              title="Connect Instagram"
              description="Link your account to start personalising."
              onPress={() => router.push("/connect-instagram")}
            />
          )}
        </Section>

        {/* APP */}
        <Section title="App" subtitle="Policies and build info." icon="🛡">
          <NavRow
            icon="🔒"
            iconBg="rgba(99, 102, 241, 0.18)"
            iconColor={Colors.indigo}
            title="Privacy policy"
            description="How MyFeed handles your data."
            onPress={() => router.push("/privacy")}
          />
          <InfoRow
            icon="🏷"
            iconBg="rgba(255, 255, 255, 0.06)"
            iconColor={Colors.textMuted}
            title="Version"
            value={String(Constants.expoConfig?.version ?? "1.0.0")}
          />
        </Section>

        {/* SIGN OUT */}
        <View style={styles.signOutWrap}>
          <LinearGradient
            colors={["rgba(239,68,68,0.55)", "rgba(239,68,68,0.15)"] as unknown as readonly [
              string,
              string,
              ...string[]
            ]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.signOutGradient}
          >
            <Pressable
              onPress={onSignOut}
              style={({ pressed }) => [
                styles.signOutInner,
                { opacity: pressed ? 0.7 : 1 },
              ]}
            >
              <Text style={styles.signOutIcon}>⎋</Text>
              <Text style={styles.signOutText}>Sign out</Text>
            </Pressable>
          </LinearGradient>
        </View>

        <Text
          style={[
            Typography.caption,
            { color: Colors.textSubtle, textAlign: "center", marginTop: Spacing[3] },
          ]}
        >
          MyFeed · Made for the hackathon
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

/* ------------------------------ primitives ------------------------------ */

function Section({
  title,
  subtitle,
  icon,
  children,
}: {
  title: string;
  subtitle?: string;
  icon?: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: Spacing[3] }}>
      <View style={styles.sectionHeader}>
        {icon ? (
          <View style={styles.sectionIcon}>
            <Text style={{ fontSize: 14 }}>{icon}</Text>
          </View>
        ) : null}
        <View style={{ flex: 1 }}>
          <Text style={[Typography.smallBold, { color: Colors.text, letterSpacing: 0.4 }]}>
            {title}
          </Text>
          {subtitle ? (
            <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
              {subtitle}
            </Text>
          ) : null}
        </View>
      </View>
      <View style={styles.sectionCard}>
        {children}
      </View>
    </View>
  );
}

function IconTile({
  icon,
  bg,
  color,
}: {
  icon: string;
  bg: string;
  color: string;
}) {
  return (
    <View style={[styles.iconTile, { backgroundColor: bg }]}>
      <Text style={[styles.iconTileText, { color }]}>{icon}</Text>
    </View>
  );
}

function InfoRow({
  icon,
  iconBg,
  iconColor,
  title,
  value,
  valueColor,
  valueDot,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  value: string;
  valueColor?: string;
  valueDot?: string;
}) {
  return (
    <View style={styles.row}>
      <IconTile icon={icon} bg={iconBg} color={iconColor} />
      <View style={styles.rowText}>
        <Text style={[Typography.smallBold, { color: Colors.textMuted, letterSpacing: 0.3 }]}>
          {title}
        </Text>
        <View style={styles.valueRow}>
          {valueDot ? (
            <View
              style={[
                styles.valueDot,
                { backgroundColor: valueDot },
              ]}
            />
          ) : null}
          <Text
            style={[
              Typography.bodyBold,
              { color: valueColor ?? Colors.text, flexShrink: 1 },
            ]}
            numberOfLines={1}
          >
            {value}
          </Text>
        </View>
      </View>
    </View>
  );
}

function ToggleRow({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  value,
  onChange,
  disabled,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description?: string;
  value: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
}) {
  return (
    <View style={styles.row}>
      <IconTile icon={icon} bg={iconBg} color={iconColor} />
      <View style={styles.rowText}>
        <Text style={[Typography.bodyBold, { color: Colors.text }]}>{title}</Text>
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
        ios_backgroundColor={Colors.surfaceStrong}
      />
    </View>
  );
}

function NavRow({
  icon,
  iconBg,
  iconColor,
  title,
  description,
  onPress,
  destructive = false,
}: {
  icon: string;
  iconBg: string;
  iconColor: string;
  title: string;
  description?: string;
  onPress: () => void;
  destructive?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.row, { opacity: pressed ? 0.55 : 1 }]}
    >
      <IconTile icon={icon} bg={iconBg} color={iconColor} />
      <View style={styles.rowText}>
        <Text
          style={[
            Typography.bodyBold,
            { color: destructive ? Colors.danger : Colors.text },
          ]}
        >
          {title}
        </Text>
        {description ? (
          <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2 }]}>
            {description}
          </Text>
        ) : null}
      </View>
      <View style={styles.chevron}>
        <Text style={{ color: Colors.textSubtle, fontSize: 22, fontWeight: "300" }}>›</Text>
      </View>
    </Pressable>
  );
}

/* --------------------------------- styles -------------------------------- */

const styles = StyleSheet.create({
  scroll: {
    paddingHorizontal: Spacing[5],
    gap: Spacing[6],
  },
  header: {
    gap: Spacing[1],
    paddingHorizontal: Spacing[1],
  },
  heroWrap: {
    borderRadius: Radius["5xl"],
    overflow: "hidden",
  },
  heroGradient: {
    padding: 2,
  },
  heroInner: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[4],
    padding: Spacing[5],
    backgroundColor: Colors.surface,
    borderRadius: Radius["4xl"],
  },
  avatarOuter: {
    width: 76,
    height: 76,
    borderRadius: Radius["5xl"],
    padding: 3,
  },
  avatarRing: {
    flex: 1,
    borderRadius: Radius["4xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInner: {
    flex: 1,
    width: "100%",
    borderRadius: Radius["4xl"],
    backgroundColor: Colors.background,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: {
    fontSize: 28,
    fontWeight: "800",
    color: Colors.pink,
    letterSpacing: 0.5,
  },
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
  iconTileText: { fontSize: 16, fontWeight: "700" },
  rowText: { flex: 1, gap: 2 },
  valueRow: { flexDirection: "row", alignItems: "center", gap: Spacing[2], marginTop: 2 },
  valueDot: { width: 8, height: 8, borderRadius: 4 },
  chevron: {
    width: 28,
    height: 28,
    alignItems: "center",
    justifyContent: "center",
  },
  signOutWrap: {
    borderRadius: Radius["5xl"],
    overflow: "hidden",
  },
  signOutGradient: {
    padding: 1.5,
  },
  signOutInner: {
    backgroundColor: Colors.surface,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[4],
    borderRadius: Radius["4xl"],
  },
  signOutIcon: { color: Colors.danger, fontSize: 18, fontWeight: "700" },
  signOutText: { color: Colors.danger, fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
});
