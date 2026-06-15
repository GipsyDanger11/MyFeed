/**
 * Database access layer — typed helpers for every table in MyFeed.
 * Use these instead of calling supabase.from(...) directly so the
 * auth/RLS contract is consistent.
 */
import { supabase } from "@/lib/supabase";
import type {
  AutomationLog,
  InstagramConnection,
  InstagramStatus,
  Preference,
  Profile,
  ProfileInsert,
  TopicDirection,
} from "@/types/database";

// --- profiles --------------------------------------------------------------

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertProfile(input: ProfileInsert): Promise<Profile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert(input, { onConflict: "id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function markOnboarded(userId: string): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ onboarded_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function setAutomationPaused(userId: string, paused: boolean): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({ automation_paused: paused, updated_at: new Date().toISOString() })
    .eq("id", userId);
  if (error) throw error;
}

export async function updatePersonalizationScore(userId: string, score: number): Promise<void> {
  const { error } = await supabase
    .from("profiles")
    .update({
      personalization_score: Math.max(0, Math.min(100, score)),
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);
  if (error) throw error;
}

// --- preferences -----------------------------------------------------------

export async function getPreferences(userId: string): Promise<Preference[]> {
  const { data, error } = await supabase
    .from("preferences")
    .select("*")
    .eq("user_id", userId);
  if (error) throw error;
  return data ?? [];
}

export async function replacePreferences(
  userId: string,
  topics: { topic: string; direction: TopicDirection }[],
): Promise<void> {
  // Wipe and re-insert — simpler than diffing for a small list.
  const { error: delErr } = await supabase.from("preferences").delete().eq("user_id", userId);
  if (delErr) throw delErr;
  if (topics.length === 0) return;
  const { error: insErr } = await supabase
    .from("preferences")
    .insert(topics.map((t) => ({ user_id: userId, topic: t.topic, direction: t.direction })));
  if (insErr) throw insErr;
}

// --- instagram connections -------------------------------------------------

export async function getInstagramConnection(
  userId: string,
): Promise<InstagramConnection | null> {
  const { data, error } = await supabase
    .from("instagram_connections")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data;
}

export async function upsertInstagramConnection(input: {
  userId: string;
  username: string;
  encryptedSession: string;
  status: InstagramStatus;
  lastSync?: string;
}): Promise<InstagramConnection> {
  const { data, error } = await supabase
    .from("instagram_connections")
    .upsert(
      {
        user_id: input.userId,
        username: input.username,
        encrypted_session: input.encryptedSession,
        status: input.status,
        last_sync: input.lastSync ?? new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
      { onConflict: "user_id" },
    )
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function setInstagramStatus(
  userId: string,
  status: InstagramStatus,
  errorMessage?: string,
): Promise<void> {
  const { error } = await supabase
    .from("instagram_connections")
    .update({
      status,
      error_message: errorMessage ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("user_id", userId);
  if (error) throw error;
}

export async function deleteInstagramConnection(userId: string): Promise<void> {
  const { error } = await supabase.from("instagram_connections").delete().eq("user_id", userId);
  if (error) throw error;
}

// --- automation logs -------------------------------------------------------

export async function getRecentLogs(userId: string, limit = 20): Promise<AutomationLog[]> {
  const { data, error } = await supabase
    .from("automation_logs")
    .select("*")
    .eq("user_id", userId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw error;
  return data ?? [];
}

export async function countActionsToday(userId: string): Promise<number> {
  const startOfDay = new Date();
  startOfDay.setHours(0, 0, 0, 0);
  const { count, error } = await supabase
    .from("automation_logs")
    .select("*", { count: "exact", head: true })
    .eq("user_id", userId)
    .gte("created_at", startOfDay.toISOString());
  if (error) throw error;
  return count ?? 0;
}
