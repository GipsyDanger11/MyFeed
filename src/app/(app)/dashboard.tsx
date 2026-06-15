/**
 * Dashboard — automation status hero, stats grid, activity log,
 * and quick "Run now" button. Subscribes to automation_logs via
 * Supabase Realtime for live updates.
 */
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
  GradientButton,
  GradientText,
  StatusPill,
} from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import {
  countActionsToday,
  getInstagramConnection,
  getRecentLogs,
  setAutomationPaused,
  upsertProfile,
} from "@/lib/db";
import { triggerRunNow } from "@/lib/automation-api";
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
  const [runNowFeedback, setRunNowFeedback] = useState<string | undefined>();

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
    setRunNowFeedback(undefined);
    try {
      const res = await triggerRunNow(user.id);
      setRunNowFeedback(`Queued ${res.actions_planned} actions.`);
      await load();
    } catch (e: unknown) {
      setRunNowFeedback(e instanceof Error ? e.message : "Run failed.");
    } finally {
      setTriggering(false);
    }
  }

  const paused = !!profile?.automation_paused;
  const status: "connected" | "disconnected" | "connecting" | "error" =
    connection?.status ?? "disconnected";

  return (
    <GradientBackground>
      <ScrollView
        contentContainerStyle={[
          styles.scroll,
          { paddingTop: insets.top + Spacing[4], paddingBottom: insets.bottom + Spacing[10] },
        ]}
        showsVerticalScrollIndicator={false}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.pink} />}
      >
        <View style={styles.topBar}>
          <View>
            <Text style={[Typography.caption, { color: Colors.textMuted }]}>
              Welcome back
            </Text>
            <GradientText
              text={profile?.display_name ?? "Friend"}
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              style={Typography.h2}
            />
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.7 : 1 }]}
            hitSlop={8}
          >
            <Text style={styles.avatarText}>
              {(profile?.display_name ?? "U").charAt(0).toUpperCase()}
            </Text>
          </Pressable>
        </View>

        {/* Hero: automation status */}
        <GlassCard padding={6} radius="2xl" accent glow style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <View style={{ flex: 1 }}>
              <Text style={[Typography.smallBold, { color: Colors.textMuted }]}>AUTOMATION</Text>
              <Text style={[Typography.h2, { color: Colors.text, marginTop: Spacing[1] }]}>
                {paused ? "Paused" : "Active"}
              </Text>
            </View>
            <Switch
              value={!paused}
              onValueChange={(v) => onTogglePaused(!v)}
              disabled={toggling}
              trackColor={{ false: Colors.surfaceStrong, true: Colors.purple }}
              thumbColor="#fff"
            />
          </View>

          <View style={styles.heroFooter}>
            <StatusPill
              label={
                status === "connected"
                  ? "🟢 Instagram connected"
                  : status === "connecting"
                    ? "🟡 Connecting..."
                    : status === "error"
                      ? "⚠️ Connection error"
                      : "🔴 Disconnected"
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
            {connection?.last_sync ? (
              <Text style={[Typography.caption, { color: Colors.textSubtle, marginLeft: Spacing[2] }]}>
                Last sync {formatTimeAgo(connection.last_sync)}
              </Text>
            ) : null}
          </View>
        </GlassCard>

        {/* Stats grid */}
        <View style={styles.statsGrid}>
          <StatCard label="Actions today" value={String(actionsToday)} accent="pink" />
          <StatCard
            label="Personalization"
            value={`${profile?.personalization_score ?? 0}%`}
            accent="purple"
            progress={profile?.personalization_score ?? 0}
          />
        </View>
        <View style={styles.statsGrid}>
          <StatCard
            label="Last activity"
            value={logs[0] ? formatTimeAgo(logs[0].created_at) : "—"}
            accent="indigo"
          />
          <StatCard
            label="Total actions"
            value={String(logs.length)}
            accent="violet"
          />
        </View>

        {/* Run now */}
        <GradientButton
          label={triggering ? "Triggering..." : "▶ Run now"}
          onPress={onRunNow}
          loading={triggering}
          disabled={paused || status !== "connected"}
        />
        {runNowFeedback ? (
          <Text
            style={[
              Typography.caption,
              { color: Colors.textMuted, textAlign: "center", marginTop: Spacing[2] },
            ]}
          >
            {runNowFeedback}
          </Text>
        ) : null}

        {/* Activity log */}
        <View style={styles.sectionHeader}>
          <Text style={[Typography.h3, { color: Colors.text }]}>Activity</Text>
          <Text style={[Typography.caption, { color: Colors.textMuted }]}>Live</Text>
        </View>
        <GlassCard padding={4} radius="2xl">
          {logs.length === 0 ? (
            <View style={styles.empty}>
              <Text style={{ fontSize: 32 }}>🛰️</Text>
              <Text style={[Typography.body, { color: Colors.textMuted, marginTop: Spacing[2], textAlign: "center" }]}>
                No activity yet. The worker will start curating your feed soon.
              </Text>
            </View>
          ) : (
            logs.map((log) => <LogRow key={log.id} log={log} />)
          )}
        </GlassCard>
      </ScrollView>
    </GradientBackground>
  );
}

function StatCard({
  label,
  value,
  accent,
  progress,
}: {
  label: string;
  value: string;
  accent: "pink" | "purple" | "indigo" | "violet";
  progress?: number;
}) {
  const accentColor =
    accent === "pink" ? Colors.pink : accent === "purple" ? Colors.purple : accent === "violet" ? Colors.violet : Colors.indigo;
  return (
    <GlassCard padding={5} radius="2xl" style={styles.statCard}>
      <Text style={[Typography.caption, { color: Colors.textMuted, textTransform: "uppercase" }]}>
        {label}
      </Text>
      <Text style={[Typography.h2, { color: accentColor, marginTop: Spacing[1] }]}>{value}</Text>
      {typeof progress === "number" ? (
        <View style={styles.progressBar}>
          <View style={[styles.progressFill, { width: `${progress}%`, backgroundColor: accentColor }]} />
        </View>
      ) : null}
    </GlassCard>
  );
}

function LogRow({ log }: { log: AutomationLog }) {
  const isLike = log.action === "like";
  const isFollow = log.action === "follow";
  const isBrowse = log.action === "browse";
  const emoji = isLike ? "❤️" : isFollow ? "➕" : isBrowse ? "👀" : "•";
  return (
    <View style={styles.logRow}>
      <View style={styles.logEmoji}>
        <Text style={{ fontSize: 18 }}>{emoji}</Text>
      </View>
      <View style={{ flex: 1 }}>
        <Text style={[Typography.smallBold, { color: Colors.text, textTransform: "capitalize" }]}>
          {log.action}
          {log.target ? ` · ${log.target}` : ""}
        </Text>
        <Text style={[Typography.caption, { color: Colors.textSubtle }]}>
          {formatTimeAgo(log.created_at)} {log.success ? "" : "· failed"}
        </Text>
      </View>
      <View
        style={[
          styles.statusDot,
          { backgroundColor: log.success ? Colors.success : Colors.danger },
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
  scroll: { paddingHorizontal: Spacing[6], gap: Spacing[4] },
  topBar: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceStrong,
    borderWidth: 1,
    borderColor: Colors.borderStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarText: { color: Colors.text, fontSize: 18, fontWeight: "700" },
  heroCard: { gap: Spacing[4] },
  heroHeader: { flexDirection: "row", alignItems: "center" },
  heroFooter: { flexDirection: "row", alignItems: "center", flexWrap: "wrap" },
  statsGrid: { flexDirection: "row", gap: Spacing[3] },
  statCard: { flex: 1, gap: Spacing[1] },
  progressBar: {
    marginTop: Spacing[2],
    height: 6,
    backgroundColor: Colors.surfaceStrong,
    borderRadius: 9999,
    overflow: "hidden",
  },
  progressFill: { height: 6, borderRadius: 9999 },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: Spacing[2],
  },
  empty: { alignItems: "center", paddingVertical: Spacing[6] },
  logRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: Spacing[3],
    paddingVertical: Spacing[3],
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: Colors.border,
  },
  logEmoji: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceStrong,
    alignItems: "center",
    justifyContent: "center",
  },
  statusDot: { width: 8, height: 8, borderRadius: 9999 },
});
