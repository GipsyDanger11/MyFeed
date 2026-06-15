/**
 * Tiny client for the Python automation worker deployed on Railway.
 * The worker exposes a few HTTP endpoints to trigger jobs and report health.
 */
import Constants from "expo-constants";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  automationApiUrl?: string;
};

const API_URL = extra.automationApiUrl ?? "";

interface TriggerRunResponse {
  ok: boolean;
  user_id: string;
  actions_planned: number;
  run_at: string;
}

export async function triggerRunNow(userId: string): Promise<TriggerRunResponse> {
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
  try {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) return { ok: false };
    return await res.json();
  } catch {
    return { ok: false };
  }
}
