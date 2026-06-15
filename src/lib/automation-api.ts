/**
 * Tiny client for the Python automation worker deployed on Railway.
 * The worker exposes a few HTTP endpoints to trigger jobs and report health.
 *
 * Demo mode (default in the hackathon build): we don't have a live worker,
 * so `triggerRunNow` synthesizes a small batch of log rows directly in
 * Supabase. The dashboard's realtime subscription picks them up so the
 * UX still feels live. Set EXPO_PUBLIC_DEMO_MODE=false to use the real
 * worker.
 */
import Constants from "expo-constants";

import { insertAutomationLog } from "@/lib/db";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  automationApiUrl?: string;
};

const API_URL = extra.automationApiUrl ?? "";
const DEMO_MODE = process.env.EXPO_PUBLIC_DEMO_MODE !== "false";

interface TriggerRunResponse {
  ok: boolean;
  user_id: string;
  actions_planned: number;
  run_at: string;
}

const DEMO_TARGETS = [
  { action: "like", target: "@techcrunch" },
  { action: "like", target: "#artificialintelligence" },
  { action: "follow", target: "@startupinsider" },
  { action: "like", target: "@nasa" },
  { action: "browse", target: "#machinelearning" },
  { action: "like", target: "@openai" },
];

export async function triggerRunNow(userId: string): Promise<TriggerRunResponse> {
  if (DEMO_MODE || !API_URL) {
    // Synthesize a small batch of log rows so the dashboard shows live
    // activity. The realtime channel inserts them into the UI.
    const batch = DEMO_TARGETS.slice(0, 3 + Math.floor(Math.random() * 3));
    for (const item of batch) {
      try {
        await insertAutomationLog({
          userId,
          action: item.action,
          target: item.target,
          success: Math.random() > 0.1,
        });
      } catch {
        /* ignore — log table may not exist in some envs */
      }
    }
    return {
      ok: true,
      user_id: userId,
      actions_planned: batch.length,
      run_at: new Date().toISOString(),
    };
  }
  const res = await fetch(`${API_URL}/run-now`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Run-now failed: ${res.status} ${text}`);
  }
  return res.json();
}

export async function checkHealth(): Promise<{ ok: boolean; uptime?: number }> {
  if (DEMO_MODE || !API_URL) return { ok: true, uptime: 0 };
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
