import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useDerivedValue,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import Animated from "react-native-reanimated";

import { GlassCard, GradientBackground, StatusPill } from "@/components/glass";
import { Colors, Gradients } from "@/constants/colors";
import { Radius, Spacing } from "@/constants/spacing";
import { Typography } from "@/constants/typography";
import { useAuth } from "@/contexts/AuthContext";
import { triggerRunNow } from "@/lib/automation-api";
import {
  avgRelevanceScore,
  countActionsToday,
  countActionType,
  countAllActions,
  getInstagramConnection,
  getRecentLogs,
  setAutomationPaused,
} from "@/lib/db";
import { supabase } from "@/lib/supabase";
import type { AutomationLog, InstagramConnection } from "@/types/database";

// ───────────────────────── hooks ─────────────────────────

function useCountUp(target: number, duration = 900): number {
  const [value, setValue] = useState(0);
  const sv = useSharedValue(0);
  const targetRef = useRef(target);
  const initialised = useRef(false);

  useEffect(() => {
    if (!initialised.current) {
      sv.value = target;
      setValue(target);
      initialised.current = true;
      return;
    }
    targetRef.current = target;
    sv.value = withTiming(target, {
      duration,
      easing: Easing.out(Easing.cubic),
    });
  }, [target]);

  useDerivedValue(() => {
    runOnJS(setValue)(Math.round(sv.value));
  });

  return value;
}

function useRelativeTime(iso: string | null): string {
  const [label, setLabel] = useState("");

  const update = useCallback(() => {
    if (!iso) { setLabel("—"); return; }
    const then = new Date(iso).getTime();
    const diff = Math.max(0, Date.now() - then);
    const m = Math.floor(diff / 60000);
    if (m < 1) { setLabel("just now"); return; }
    if (m < 60) { setLabel(`${m}m ago`); return; }
    const h = Math.floor(m / 60);
    if (h < 24) { setLabel(`${h}h ago`); return; }
    const d = Math.floor(h / 24);
    setLabel(`${d}d ago`);
  }, [iso]);

  useEffect(() => {
    update();
    const id = setInterval(update, 60000);
    return () => clearInterval(id);
  }, [update]);

  return label;
}

// ──────────────────────── main screen ────────────────────

interface DashboardStats {
  actionsToday: number;
  postsLiked: number;
  accountsFollowed: number;
  avgRelevance: number;
  totalActions: number;
}

export default function DashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, profile, refreshProfile } = useAuth();

  const [connection, setConnection] = useState<InstagramConnection | null>(null);
  const [logs, setLogs] = useState<AutomationLog[]>([]);
  const [stats, setStats] = useState<DashboardStats>({
    actionsToday: 0,
    postsLiked: 0,
    accountsFollowed: 0,
    avgRelevance: 0,
    totalActions: 0,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState(false);
  const [triggering, setTriggering] = useState(false);
  const [toast, setToast] = useState<{ kind: "success" | "error"; message: string } | undefined>();
  const [reconnecting, setReconnecting] = useState(false);
  const [statsError, setStatsError] = useState(false);
  const [logsError, setLogsError] = useState(false);
  const [loaded, setLoaded] = useState(false);

  const load = useCallback(async () => {
    if (!user?.id) return;
    setStatsError(false);
    setLogsError(false);
    try {
      const [conn, recent, today, liked, followed, avgRel, total] = await Promise.all([
        getInstagramConnection(user.id),
        getRecentLogs(user.id, 20),
        countActionsToday(user.id),
        countActionType(user.id, "like"),
        countActionType(user.id, "follow"),
        avgRelevanceScore(user.id),
        countAllActions(user.id),
      ]);
      setConnection(conn);
      setLogs(recent);
      setStats({ actionsToday: today, postsLiked: liked, accountsFollowed: followed, avgRelevance: avgRel, totalActions: total });
    } catch {
      setStatsError(true);
      setLogsError(true);
    } finally {
      setLoaded(true);
    }
  }, [user?.id]);

  useEffect(() => { void load(); }, [load]);

  // Realtime subscription
  useEffect(() => {
    if (!user?.id) return;
    const channel = supabase
      .channel(`dashboard:${user.id}`)
      .on<AutomationLog>(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "automation_logs", filter: `user_id=eq.${user.id}` },
        (payload) => {
          const log = payload.new as AutomationLog;
          setLogs((prev) => {
            if (prev.some((l) => l.id === log.id)) return prev;
            // Stats increment mirrors the log prepend
            setStats((s) => ({
              ...s,
              actionsToday: s.actionsToday + 1,
              postsLiked: s.postsLiked + (log.action === "like" ? 1 : 0),
              accountsFollowed: s.accountsFollowed + (log.action === "follow" ? 1 : 0),
              totalActions: s.totalActions + 1,
            }));
            return [log, ...prev].slice(0, 20);
          });
        },
      )
      .subscribe((status) => {
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          setReconnecting(true);
        } else {
          setReconnecting(false);
        }
      });
    return () => { void supabase.removeChannel(channel); };
  }, [user?.id]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(undefined), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  // Keep reconnecting banner visible for at least 2s
  const reconnectTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (reconnecting) {
      clearTimeout(reconnectTimer.current);
    } else {
      reconnectTimer.current = setTimeout(() => setReconnecting(false), 2000);
    }
    return () => clearTimeout(reconnectTimer.current);
  }, [reconnecting]);

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
      setToast({ kind: "success", message: `✓ ${res.actions_planned} actions queued` });
      await load();
    } catch (e: unknown) {
      setToast({ kind: "error", message: e instanceof Error ? e.message : "Run failed." });
    } finally {
      setTriggering(false);
    }
  }

  const paused = !!profile?.automation_paused;
  const status: "connected" | "disconnected" | "connecting" | "error" =
    connection?.status ?? "disconnected";
  const personalization = profile?.personalization_score ?? 0;
  const lastLog = logs[0];
  const lastRunLabel = useRelativeTime(lastLog?.created_at ?? null);
  const personalizationLabel =
    personalization >= 80 ? "Excellent" : personalization >= 50 ? "Improving" : "Getting started";

  if (!loaded) {
    return (
      <GradientBackground>
        <View style={[styles.center, { paddingTop: insets.top + Spacing[10] }]}>
          <SkeletonLoader />
        </View>
      </GradientBackground>
    );
  }

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
        {reconnecting && <ReconnectingBanner />}

        {/* Top bar */}
        <View style={styles.topBar}>
          <View style={{ flex: 1 }}>
            <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1 }]}>
              Welcome back
            </Text>
            <Text
              style={[Typography.h1, { fontSize: 26, lineHeight: 30, color: Colors.text, marginTop: 2 }]}
              numberOfLines={1}
            >
              {profile?.display_name ?? "Friend"}
            </Text>
          </View>
          <Pressable
            onPress={() => router.push("/settings")}
            style={({ pressed }) => [styles.avatar, { opacity: pressed ? 0.7 : 1 }]}
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

        {/* Hero automation status */}
        <GlassCard padding={5} radius="5xl" style={{ gap: Spacing[2] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 1.5 }]}>
              AUTOMATION
            </Text>
            <StatusPill
              label={paused ? "Paused" : "Active"}
              variant={paused ? "warning" : "success"}
            />
          </View>
          <Text style={[Typography.body, { color: Colors.textMuted, lineHeight: 20 }]}>
            {paused
              ? "Automation is off. New posts won't be liked or followed."
              : status === "connected"
                ? "Working in the background. Tap Run now to trigger a batch."
                : "Connect Instagram to start curating."}
          </Text>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between", marginTop: Spacing[1] }}>
            <StatusPill
              label={
                status === "connected" ? "Connected"
                  : status === "connecting" ? "Connecting…"
                    : status === "error" ? "Error"
                      : "Disconnected"
              }
              variant={
                status === "connected" ? "success"
                  : status === "connecting" ? "warning"
                    : status === "error" ? "danger"
                      : "neutral"
              }
              dot={false}
            />
            <Pressable
              onPress={() => onTogglePaused(!paused)}
              disabled={toggling}
              style={({ pressed }) => [{ opacity: toggling ? 0.5 : pressed ? 0.7 : 1 }]}
            >
              <Text
                style={[
                  Typography.smallBold,
                  { color: paused ? Colors.warning : Colors.success },
                ]}
              >
                {toggling ? "…" : paused ? "Resume" : "Pause"}
              </Text>
            </Pressable>
          </View>
        </GlassCard>

        {/* Stats Dashboard — 2x3 grid */}
        <View>
          <Text style={[Typography.h3, { color: Colors.text, marginBottom: Spacing[3] }]}>
            Stats Dashboard
          </Text>
          {statsError ? (
            <View style={[styles.center, { paddingVertical: Spacing[8] }]}>
              <Text style={[Typography.body, { color: Colors.textMuted }]}>Failed to load stats.</Text>
              <Pressable onPress={load} style={styles.retryBtn}>
                <Text style={[Typography.smallBold, { color: Colors.pink }]}>Retry</Text>
              </Pressable>
            </View>
          ) : (
            <View style={{ gap: Spacing[3] }}>
              <View style={styles.statsRow}>
                <StatCard
                  icon="⚡"
                  label="Actions Today"
                  value={stats.actionsToday}
                  accent={Colors.pink}
                  index={0}
                />
                <StatCard
                  icon="❤️"
                  label="Posts Liked"
                  value={stats.postsLiked}
                  accent={Colors.purple}
                  index={1}
                />
                <StatCard
                  icon="➕"
                  label="Accounts Followed"
                  value={stats.accountsFollowed}
                  accent={Colors.indigo}
                  index={2}
                />
              </View>
              <View style={styles.statsRow}>
                <StatCard
                  icon="🎯"
                  label="Avg Relevance"
                  value={`${stats.avgRelevance}%`}
                  accent={Colors.blue}
                  index={3}
                />
                <StatCard
                  icon="🕒"
                  label="Last Run"
                  value={lastRunLabel}
                  accent={Colors.pinkSoft}
                  index={4}
                />
                <StatCard
                  icon="📊"
                  label="Total Actions"
                  value={stats.totalActions}
                  accent={Colors.purpleSoft}
                  index={5}
                />
              </View>
            </View>
          )}
        </View>

        {/* Personalization Score — full width */}
        <GlassCard padding={5} radius="5xl" style={{ gap: Spacing[3] }}>
          <View style={{ flexDirection: "row", alignItems: "center", justifyContent: "space-between" }}>
            <Text style={[Typography.smallBold, { color: Colors.text }]}>Personalization Score</Text>
            <Text style={[Typography.h2, { color: Colors.pink, fontSize: 22 }]}>{personalization}%</Text>
          </View>
          <View style={styles.progressTrack}>
            <LinearGradient
              colors={Gradients.primary as unknown as readonly [string, string, ...string[]]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={[styles.progressFill, { width: `${Math.min(100, personalization)}%` as unknown as number }]}
            />
          </View>
          <Text style={[Typography.caption, { color: Colors.textMuted }]}>
            {personalizationLabel} — {stats.totalActions} total actions
          </Text>
        </GlassCard>

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
        {toast && (
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
        )}

        {/* Live Activity Log */}
        <View>
          <View style={styles.sectionHeader}>
            <Text style={[Typography.h3, { color: Colors.text }]}>Live Activity</Text>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
              <View style={[styles.liveDot, { backgroundColor: reconnecting ? Colors.warning : Colors.success }]} />
              <Text style={[Typography.caption, { color: Colors.textMuted }]}>
                {reconnecting ? "Reconnecting" : "Live"}
              </Text>
            </View>
          </View>
          {logsError ? (
            <View style={[styles.center, { paddingVertical: Spacing[8] }]}>
              <Text style={[Typography.body, { color: Colors.textMuted }]}>Failed to load activity.</Text>
              <Pressable onPress={load} style={styles.retryBtn}>
                <Text style={[Typography.smallBold, { color: Colors.pink }]}>Retry</Text>
              </Pressable>
            </View>
          ) : logs.length === 0 ? (
            <GlassCard padding={6} radius="5xl">
              <View style={styles.empty}>
                <Text style={{ fontSize: 40 }}>🛰️</Text>
                <Text style={[Typography.bodyBold, { color: Colors.text, marginTop: Spacing[3] }]}>
                  No activity yet
                </Text>
                <Text style={[Typography.small, { color: Colors.textMuted, textAlign: "center", maxWidth: 260 }]}>
                  Tap "Run personalization now" to like and follow content based on your topics.
                </Text>
              </View>
            </GlassCard>
          ) : (
            <View style={{ gap: Spacing[2] }}>
              {logs.map((log, i) => (
                <ActivityRow key={log.id} log={log} index={i} />
              ))}
            </View>
          )}
        </View>

        <Text style={[Typography.caption, { color: Colors.textSubtle, textAlign: "center", marginTop: Spacing[3] }]}>
          Pull down to refresh · New activity appears instantly
        </Text>
      </ScrollView>
    </GradientBackground>
  );
}

// ──────────────────────── sub-components ─────────────────

function StatCard({
  icon,
  label,
  value,
  accent,
  index,
}: {
  icon: string;
  label: string;
  value: number | string;
  accent: string;
  index: number;
}) {
  const opacity = useSharedValue(0);
  const translateY = useSharedValue(20);

  useEffect(() => {
    opacity.value = withDelay(index * 100, withTiming(1, { duration: 400 }));
    translateY.value = withDelay(index * 100, withSpring(0, { damping: 15 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [{ translateY: translateY.value }],
  }));

  const isNumeric = typeof value === "number";
  const displayVal = isNumeric ? useCountUp(value as number) : value;

  return (
    <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <GlassCard padding={3.5} radius="5xl" style={{ gap: Spacing[1], minHeight: 90 }}>
        <View style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" }}>
          <Text style={[Typography.caption, { color: Colors.textMuted, letterSpacing: 0.5, flex: 1 }]} numberOfLines={1}>
            {label}
          </Text>
          <Text style={{ fontSize: 16 }}>{icon}</Text>
        </View>
        <Text style={[Typography.h2, { color: accent, fontSize: 24, lineHeight: 28 }]}>
          {isNumeric ? displayVal : displayVal}
        </Text>
      </GlassCard>
    </Animated.View>
  );
}

function ActivityRow({ log, index }: { log: AutomationLog; index: number }) {
  const isGreen = log.success && (log.action === "like" || log.action === "follow");
  const isYellow = !log.success && log.action === "skip";
  const isRed = !log.success && (log.action === "error" || (!log.success && log.action !== "skip"));

  const icon = isGreen ? "✅" : isYellow ? "⚠️" : "❌";
  const borderColor = isGreen ? Colors.success : isYellow ? Colors.warning : Colors.danger;
  const bgColor = isGreen
    ? "rgba(34,197,94,0.08)"
    : isYellow
      ? "rgba(245,158,11,0.08)"
      : "rgba(239,68,68,0.08)";

  let description: string;
  if (log.action === "like") {
    description = `Liked post about ${log.target ?? "unknown"}`;
  } else if (log.action === "follow") {
    description = `Followed ${log.target ?? "unknown"}`;
  } else if (log.action === "skip") {
    description = `Skipped post (relevance score: ${log.relevance_score ?? "?"}%)`;
  } else {
    description = `Error on ${log.target ?? log.error_message ?? "unknown"}`;
  }

  const timeAgo = useRelativeTime(log.created_at);

  const translateX = useSharedValue(60);
  const opacity = useSharedValue(0);

  useEffect(() => {
    translateX.value = withDelay(index * 30, withSpring(0, { damping: 16, stiffness: 120 }));
    opacity.value = withDelay(index * 30, withTiming(1, { duration: 200 }));
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }],
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={animatedStyle}>
      <View style={{ borderRadius: Radius["4xl"], overflow: "hidden", borderLeftWidth: 3, borderLeftColor: borderColor, backgroundColor: bgColor }}>
        <GlassCard padding={3.5} radius="4xl" style={{ borderWidth: 0 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: Spacing[3] }}>
            <Text style={{ fontSize: 16 }}>{icon}</Text>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={[Typography.small, { color: Colors.text, lineHeight: 18 }]} numberOfLines={2}>
                {description}
              </Text>
              <Text style={[Typography.caption, { color: Colors.textSubtle }]}>{timeAgo}</Text>
            </View>
          </View>
        </GlassCard>
      </View>
    </Animated.View>
  );
}

function ReconnectingBanner() {
  return (
    <View style={styles.reconnectBanner}>
      <View style={[styles.liveDot, { backgroundColor: Colors.warning }]} />
      <Text style={[Typography.smallBold, { color: Colors.warning }]}>Reconnecting…</Text>
    </View>
  );
}

function SkeletonLoader() {
  const shimmer = { backgroundColor: Colors.surface, borderRadius: Radius["3xl"] };
  return (
    <View style={{ gap: Spacing[5], paddingHorizontal: Spacing[5] }}>
      <View style={{ gap: Spacing[2] }}>
        <View style={[shimmer, { width: 80, height: 14 }]} />
        <View style={[shimmer, { width: 160, height: 24 }]} />
      </View>
      <View style={[shimmer, { height: 90 }]} />
      <View style={{ flexDirection: "row", gap: Spacing[3] }}>
        <View style={[shimmer, { flex: 1, height: 90 }]} />
        <View style={[shimmer, { flex: 1, height: 90 }]} />
        <View style={[shimmer, { flex: 1, height: 90 }]} />
      </View>
      <View style={{ flexDirection: "row", gap: Spacing[3] }}>
        <View style={[shimmer, { flex: 1, height: 90 }]} />
        <View style={[shimmer, { flex: 1, height: 90 }]} />
        <View style={[shimmer, { flex: 1, height: 90 }]} />
      </View>
      <View style={[shimmer, { height: 80 }]} />
      <View style={[shimmer, { height: 48 }]} />
      <View style={[shimmer, { height: 60 }]} />
    </View>
  );
}

// ──────────────────────── styles ─────────────────────────

const styles = StyleSheet.create({
  scroll: { paddingHorizontal: Spacing[5], gap: Spacing[5] },
  center: { alignItems: "center", justifyContent: "center" },
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
  statsRow: {
    flexDirection: "row",
    gap: Spacing[2.5],
  },
  progressTrack: {
    height: 8,
    borderRadius: Radius.full,
    backgroundColor: Colors.surfaceStrong,
    overflow: "hidden",
  },
  progressFill: {
    height: "100%",
    borderRadius: Radius.full,
  },
  runNowWrap: { borderRadius: Radius["5xl"], overflow: "hidden" },
  runNow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 18,
    gap: Spacing[2],
  },
  runNowEmoji: { color: "#fff", fontSize: 16, fontWeight: "800" },
  runNowText: { color: "#fff", fontSize: 16, fontWeight: "700", letterSpacing: 0.3 },
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
    marginBottom: Spacing[3],
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },

  empty: { alignItems: "center", paddingVertical: Spacing[6], gap: Spacing[2] },
  reconnectBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: Spacing[2],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[4],
    backgroundColor: "rgba(245,158,11,0.12)",
    borderRadius: Radius["3xl"],
    borderWidth: 1,
    borderColor: "rgba(245,158,11,0.3)",
  },
  retryBtn: {
    marginTop: Spacing[3],
    paddingVertical: Spacing[2],
    paddingHorizontal: Spacing[5],
    borderRadius: Radius["3xl"],
    borderWidth: 1,
    borderColor: Colors.pink,
  },
});
