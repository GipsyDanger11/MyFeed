/**
 * Supabase client for MyFeed
 *
 * Authentication persists in AsyncStorage (native) or localStorage (web)
 * so the session survives app restarts. The storage adapter is selected
 * at runtime so the same code works on iOS, Android, and the browser.
 *
 * Environment variables are read from Expo's `expo-constants` extra field,
 * which is populated by app.json / EAS env / .env files. If not set we fall
 * back to the public URL configured in app.json (safe to ship — anon key only).
 */
import { createClient } from "@supabase/supabase-js";
import { Platform } from "react-native";

import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const rawUrl =
  extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";

// Be defensive: the URL may be either the bare project URL
// (https://xxx.supabase.co) or already include /rest/v1.
// Strip it so we don't end up with a double /rest/v1 in the path.
function normalizeSupabaseUrl(url: string): string {
  let base = url.trim().replace(/\/+$/, "");
  for (const suffix of ["/rest/v1", "/rest/v1/"]) {
    if (base.endsWith(suffix)) {
      base = base.slice(0, -suffix.length);
      break;
    }
  }
  return base;
}

export const supabaseUrl = normalizeSupabaseUrl(rawUrl);
const supabaseAnonKey =
  extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing URL or anon key. Set them in app.json -> expo.extra or as EXPO_PUBLIC_* env vars.",
  );
}

/**
 * Cross-platform auth storage:
 *  - native (iOS / Android) uses @react-native-async-storage/async-storage
 *  - web uses window.localStorage (only loaded on the client to avoid
 *    the "window is not defined" SSR crash)
 */
type AuthStorage = {
  getItem: (key: string) => Promise<string | null>;
  setItem: (key: string, value: string) => Promise<void>;
  removeItem: (key: string) => Promise<void>;
};

function buildStorage(): AuthStorage {
  if (Platform.OS === "web") {
    if (typeof window === "undefined") {
      // SSR: fall back to a no-op storage. The real adapter kicks in
      // once the bundle hydrates on the client.
      return {
        async getItem() { return null; },
        async setItem() { /* noop */ },
        async removeItem() { /* noop */ },
      };
    }
    return {
      async getItem(key) { return window.localStorage.getItem(key); },
      async setItem(key, value) { window.localStorage.setItem(key, value); },
      async removeItem(key) { window.localStorage.removeItem(key); },
    };
  }
  // Native: lazy-require AsyncStorage so it never gets evaluated on web
  // (it crashes at import time when window is undefined).
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const AsyncStorage = require("@react-native-async-storage/async-storage").default;
  return {
    async getItem(key) { return AsyncStorage.getItem(key); },
    async setItem(key, value) { return AsyncStorage.setItem(key, value); },
    async removeItem(key) { return AsyncStorage.removeItem(key); },
  };
}

/**
 * Wraps the global fetch with a 15-second timeout so auth / data requests
 * never hang indefinitely. The timeout applies to *every* Supabase call
 * made through this client.
 */
async function fetchWithTimeout(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), 15_000);
  try {
    const res = await fetch(input, { ...init, signal: controller.signal });
    return res;
  } finally {
    clearTimeout(id);
  }
}

// Typed loosely here for simplicity; all calls go through src/lib/db.ts which
// narrows rows to our database types in src/types/database.ts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: buildStorage(),
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
  global: { fetch: fetchWithTimeout },
});
