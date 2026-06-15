/**
 * Supabase client for MyFeed
 *
 * Authentication persists in AsyncStorage so the session survives app restarts.
 *
 * Environment variables are read from Expo's `expo-constants` extra field,
 * which is populated by app.json / EAS env / .env files. If not set we fall
 * back to the public URL configured in app.json (safe to ship — anon key only).
 */
import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

import Constants from "expo-constants";
import "react-native-url-polyfill/auto";

const extra = (Constants.expoConfig?.extra ?? {}) as {
  supabaseUrl?: string;
  supabaseAnonKey?: string;
};

const supabaseUrl =
  extra.supabaseUrl ?? process.env.EXPO_PUBLIC_SUPABASE_URL ?? "";
const supabaseAnonKey =
  extra.supabaseAnonKey ?? process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ?? "";

if (!supabaseUrl || !supabaseAnonKey) {
  // eslint-disable-next-line no-console
  console.warn(
    "[supabase] Missing URL or anon key. Set them in app.json -> expo.extra or as EXPO_PUBLIC_* env vars.",
  );
}

// Typed loosely here for simplicity; all calls go through src/lib/db.ts which
// narrows rows to our database types in src/types/database.ts.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
});
