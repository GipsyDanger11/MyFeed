/**
 * Dashboard — automation status hero, stats grid, activity log,
 * and quick "Run now" button. Subscribes to automation_logs via
 * Supabase Realtime for live updates.
 *
 * Visual language:
 *  - large hero card with bold Active/Paused text
 *  - circular progress ring for personalization
 *  - 4 colored stat cards in a 2x2 grid
 *  - activity log with colored action chips
 *  - success toast feedback after Run now
 */
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
    ActivityIndicator,
    Pressable,
    RefreshControl,
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
    GradientText,
    StatusPill,
} from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { triggerRunNow } from "@/lib/automation-api";
import {
    countActionsToday,
    getInstagramConnection,
    getRecentLogs,
    setAutomationPaused,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { AutomationLog, InstagramConnection } from "@/types/database";

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();

  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [actionsToday, setActionsToday] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | undefined>();

  const load = useCallback(async () => {
    if (!user?.id) return;
    const [conn, recent, today] = await Promise.all([
      getInstagramConnection(user.id),
      getRecentLogs(user.id, 15),
      countActionsToday(user.id),
    ]);
    setConnection(conn);
    setLogs(recent);
    setActionsToday(today);
  }, [user?.id]);

  useEffect(() => {
    void load();
  }, [load]);

  // Realtime subscription for new automation_logs rows.
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`logs:${user.id}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "automation_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          setLogs((prev) => [payload.new as AutomationLog, ...prev].slice(0, 15));
          setActionsToday((c) => c + 1);
        },
      )
      .subscribe();
    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id]);

  // Auto-dismiss the toast after a few seconds.
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  async function onRefresh() {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  }

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

  async function onRunNow() {
    if (!user?.id) return;
    setTriggering(true);
    setToast(undefined);
    try {
      const res = await triggerRunNow(user.id);
      setToast({
        kind: "success",
        message: `✓ ${res.actions_planned} actions queued`,
      });
      await load();
    } catch (e: unknown) {
      setToast({
        kind: "error",
        message: e instanceof Error ? e.message : "Run failed.",
      });
    } finally {
      setTriggering(false);
    }
  }

  const paused = !!profile?.automation_paused;
  const status: "connected" | "disconnected" | "connecting" | "error" =
    connection?.status ?? "disconnected";
  const personalization = profile?.personalization_score ?? 0;

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing[5], paddingBottom: insets.bottom + Spacing[10] },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={Colors.pink}
            colors={[Colors.pink]}
          />
        }
      >
        {/* Header */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }]}>
              Welcome back
            </Text>
            <GradientText
              text={profile?.display_name ?? "Friend"}
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={[Typography.h1, { fontSize: 28, lineHeight: 32, marginTop: 2 }]}
            />
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [
              styles.avatar,
              { opacity: pressed ? 0.7 : 1 },
            ]}
            hitSlop={8}
          >
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={styles.avatarFill}
            >
              <Text style={styles.avatarText}>
                {(profile?.display_name ?? "U").charAt(0).toUpperCase()}
              </Text>
            </LinearGradient>
          </Pressable>
        </View>

        {/* HERO: status + circular personalization ring */}
        <View style={styles.heroRow}>
          <GlassCard
            padding={5}
            radius="5xl"
            style={styles.heroCard}
          >
            <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1.5, textTransform: "uppercase" }]}>
              Automation
            </Text>
            <View style={styles.heroStatusRow}>
              <View style={[styles.statusDot, { backgroundColor: paused ? Colors.warning : Colors.success }]} />
              <Text
                style={[
                  Typography.h1,
                  { fontSize: 36, lineHeight: 40, color: paused ? Colors.warning : Colors.success, marginLeft: Spacing[2] },
                ]}
              >
                {paused ? "Paused" : "Active"}
              </Text>
            </View>
            <Text style={[Typography.small, { color: Colors.textMuted, marginTop: Spacing[1] }]}>
              {paused
                ? "Automation is off. New posts won't be liked or followed."
                : status === "connected"
                  ? `Working in the background. Last sync ${connection?.last_sync ? formatTimeAgo(connection.last_sync) : "just now"}.`
                  : "Connect Instagram to start curating."}
            </Text>
            <View style={styles.heroToggleRow}>
              <StatusPill
                label={
                  status === "connected"
                    ? "Connected"
                    : status === "connecting"
                      ? "Connecting…"
                      : status === "error"
                        ? "Error"
                        : "Disconnected"
                }
                variant={
                  status === "connected"
                    ? "success"
                    : status === "connecting"
                      ? "warning"
                      : status === "error"
                        ? "danger"
                        : "neutral"
                }
              />
              <View style={styles.toggleWrap}>
                <Text style={[Typography.smallBold, { color: paused ? Colors.textMuted : Colors.text, marginRight: Spacing[2] }]}>
                  {paused ? "Off" : "On"}
                </Text>
                <Switch
                  value={!paused}
                  onValueChange={(v) => onTogglePaused(!v)}
                  disabled={toggling}
                  trackColor={{ false: Colors.surfaceStrong, true: Colors.purple }}
                  thumbColor="#fff"
                  ios_backgroundColor={Colors.surfaceStrong}
                />
              </View>
            </View>
          </GlassCard>

          <PersonalizationRing percent={personalization} />
        </View>

        {/* Stats grid 2x2 */}
        <View style={styles.statsGrid}>
          <StatCard
            label="Today"
            value={String(actionsToday)}
            unit="actions"
            accent={Colors.pink}
            icon="⚡"
          />
          <StatCard
            label="Last activity"
            value={logs[0] ? formatTimeAgo(logs[0].created_at) : "—"}
            unit={logs[0] ? logs[0].action : "nothing yet"}
            accent={Colors.purple}
            icon="🕒"
          />
        </View>

        {/* Run now CTA */}
        <Pressable
          onPress={onRunNow}
          disabled={triggering}
          style={({ pressed }) => [
            styles.runNowWrap,
            { opacity: triggering ? 0.7 : pressed ? 0.9 : 1 },
          ]}
        >
          <LinearGradient
            colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.runNow}
          >
            {triggering ? (
              <ActivityIndicator color="#fff" />
            ) : (
              <>
                <Text style={styles.runNowEmoji}>▶</Text>
                <Text style={styles.runNowText}>Run personalization now</Text>
              </>
            )}
          </LinearGradient>
        </Pressable>

        {/* Toast feedback */}
        {toast ? (
          <View
            style={[
              styles.toast,
              {
                backgroundColor:
                  toast.kind === "success" ? "rgba(34,197,94,0.15)" : "rgba(239,68,68,0.15)",
                borderColor:
                  toast.kind === "success" ? "rgba(34,197,94,0.45)" : "rgba(239,68,68,0.45)",
              },
            ]}
          >
            <Text
              style={[
                Typography.smallBold,
                { color: toast.kind === "success" ? Colors.success : Colors.danger },
              ]}
            >
              {toast.message}
            </Text>
          </View>
        ) : null}

        {/* Activity section */}
        <View style={styles.sectionHeader}>
          <Text style={[Typography.h3, { color: Colors.text }]}>Activity</Text>
          <View style={styles.liveBadge}>
            <View style={[styles.liveDot, { backgroundColor: Colors.success }]} />
            <Text style={[Typography.caption, { color: Colors.textMuted, marginLeft: 4 }]}>Live</Text>
          </View>
        </View>
        <GlassCard padding={4} radius="5xl">
          {logs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 40 }}>🛰️</Text>
              <Text style={[Typography.bodyBold, { color: Colors.text, marginTop: Spacing[3] }]}>
                Quiet in here
              </Text>
              <Text
                style={[
                  Typography.small,
                  { color: Colors.textMuted, marginTop: Spacing[1], textAlign: "center", maxWidth: 260 },
                ]}
              >
                Tap "Run personalization now" to like and follow content based on your topics.
              </Text>
            </View>
          ) : (
            logs.map((log, i) => (
              <LogRow key={log.id} log={log} isLast={i === logs.length - 1} />
            ))
          )}
        </GlassCard>

        <View style={styles.footer}>
          <Text style={[Typography.caption, { color: Colors.textSubtle, textAlign: "center" }]}>
            Pull down to refresh · Tap your avatar for settings
          </Text>
        </View>
      </ScrollView>
    </GradientBackground>
  );
}

function PersonalizationRing({ percent }: { percent: number }) {
  const clamped = Math.max(0, Math.min(100, percent));
  // Approximation: draw a thick ring using border + rotation. For a
  // production build, swap this for react-native-svg's Circle.
  return (
    <View style={styles.ringWrap}>
      <View style={styles.ringOuter}>
        <LinearGradient
          colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.ringFill}
        >
          <View style={styles.ringInner}>
            <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }]}>
              Score
            </Text>
            <GradientText
              text={`${clamped}%`}
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={[Typography.h1, { fontSize: 30, lineHeight: 34, textAlign: "center" }]}
            />
            <Text style={[Typography.caption, { color: Colors.textMuted, marginTop: 2, textAlign: "center" }]}>
              {clamped >= 80 ? "Excellent" : clamped >= 50 ? "Improving" : "Getting started"}
            </Text>
          </View>
        </LinearGradient>
      </View>
    </View>
  );
}

function StatCard({
  label,
  value,
  unit,
  accent,
  icon,
}: {
  label: string;
  value: string;
  unit: string;
  accent: string;
  icon: string;
}) {
  return (
    <GlassCard padding={4} radius="5xl" style={styles.statCard}>
      <View style={styles.statHeader}>
        <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1, textTransform: "uppercase" }]}>
          {label}
        </Text>
        <Text style={styles.statIcon}>{icon}</Text>
      </View>
      <Text style={[Typography.h1, { fontSize: 28, lineHeight: 32, color: accent, marginTop: 6 }]}>
        {value}
      </Text>
      <Text style={[Typography.caption, { color: Colors.textSubtle, marginTop: 2 }]} numberOfLines={1}>
        {unit}
      </Text>
    </GlassCard>
  );
}

function LogRow({ log, isLast }: { log: AutomationLog; isLast: boolean }) {
  const isLike = log.action === "like";
  const isFollow = log.action === "follow";
  const isBrowse = log.action === "browse";
  const emoji = isLike ? "❤️" : isFollow ? "➕" : isBrowse ? "👀" : "•";
  const color = isLike
    ? { fg: Colors.danger, bg: "rgba(239,68,68,0.12)" }
    : isFollow
      ? { fg: Colors.purple, bg: "rgba(139,92,246,0.15)" }
      : isBrowse
        ? { fg: Colors.indigo, bg: "rgba(99,102,241,0.15)" }
        : { fg: Colors.textMuted, bg: Colors.surfaceStrong };
  return (
    <View style={[styles.logRow, isLast && { borderBottomWidth: 0 }]}>
      <View style={[styles.logIcon, { backgroundColor: color.bg }]}>
        <Text style={{ fontSize: 16 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <View style={styles.logTitleRow}>
          <Text
            style={[
              Typography.smallBold,
              { color: Colors.text, textTransform: "capitalize" },
            ]}
          >
            {log.action}
          </Text>
          {log.target ? (
            <Text style={[Typography.small, { color: Colors.textMuted, marginLeft: 4 }]} numberOfLines={1}>
              {log.target}
            </Text>
          ) : null}
        </View>
        <Text style={[Typography.caption, { color: Colors.textSubtle, marginTop: 2 }]}>
          {formatTimeAgo(log.created_at)}
          {!log.success ? " · failed" : ""}
        </Text>
      </View>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: log.success ? Colors.success : Colors.danger, width: 8, height: 8 },
        ]}
      />
    </View>
  );
}

function formatTimeAgo(iso: string): string {
  const then = new Date(iso).getTime();
  const diff = Math.max(0, Date.now() - then);
  const m = Math.floor(diff / 60000);
  if (m < 1) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  return `${d}d ago`;
}

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[5], gap: Spacing[5] },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: Radius["5xl"],
    overflow: "hidden",
  },
  avatarFill: { flex: 1, alignItems: "center", justifyContent: "center" },
  avatarText: { color: "#fff", fontSize: 18, fontWeight: "800" },
  heroRow: {
    flexDirection: "row",
    gap: Spacing[3],
  },
  heroCard: { flex: 1, gap: Spacing[2] },
  heroStatusRow: { flexDirection: "row", alignItems: "center", marginTop: Spacing[1] },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: Radius.full,
  },
  heroToggleRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: Spacing[3],
  },
  toggleWrap: { flexDirection: "row", alignItems: "center" },
  ringWrap: { width: 120, height: 120 },
  ringOuter: {
    flex: 1,
    padding: 3,
    borderRadius: Radius.full,
    overflow: "hidden",
  },
  ringFill: { flex: 1, borderRadius: Radius.full, padding: 2 },
  ringInner: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: Radius.full,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: Spacing[2],
  },
  statsGrid: { flexDirection: "row", gap: Spacing[3] },
  statCard: { flex: 1, gap: 2 },
  statHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  statIcon: { fontSize: 16 },
  runNowWrap: { borderRadius: Radius["5xl"], overflow: "hidden" },
  runNow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: Spacing[5],
    gap: Spacing[2],
  },
  runNowEmoji: { color: "#fff", fontSize: 16, fontWeight: "800" },
  runNowText: { ...Typography.bodyBold, color: "#fff", fontSize: 16, letterSpacing: 0.3 },
  toast: {
    paddingVertical: Spacing[3],
    paddingHorizontal: Spacing[4],
    borderRadius: Radius["3xl"],
    borderWidth: 1,
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing[2],
  },
  liveBadge: { flexDirection: "row", alignItems: "center" },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  empty: { alignItems: "center", paddingVertical: Spacing[8], gap: Spacing[2] },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  logIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius["2xl"],
    alignItems: "center",
    justifyContent: "center",
  },
  logTitleRow: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  footer: { marginTop: Spacing[2] },
});
