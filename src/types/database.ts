/**
 * Database schema types for MyFeed
 *
 * Mirrors the SQL schema in supabase/schema.sql
 */
export type TopicDirection = "boost" | "reduce";

export type InstagramStatus = "connected" | "disconnected" | "connecting" | "error";

export interface Profile {
  id: string;
  email: string | null;
  display_name: string | null;
  onboarded_at: string | null;
  automation_paused: boolean;
  personalization_score: number;
  created_at: string;
  updated_at: string;
}

export interface Preference {
  id: string;
  user_id: string;
  topic: string;
  direction: TopicDirection;
  created_at: string;
}

export interface InstagramConnection {
  id: string;
  user_id: string;
  username: string | null;
  /** AES-encrypted session blob (JSON stringified instagrapi settings) */
  encrypted_session: string | null;
  status: InstagramStatus;
  last_sync: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

export interface AutomationLog {
  id: string;
  user_id: string;
  action: string;
  target: string | null;
  success: boolean;
  error_message: string | null;
  created_at: string;
}

type Insertable<T> = Omit<T, "id" | "created_at" | "updated_at"> & {
  id?: string;
  created_at?: string;
  updated_at?: string;
};

export type ProfileInsert = Insertable<Profile>;
export type PreferenceInsert = Insertable<Preference>;
export type InstagramConnectionInsert = Insertable<InstagramConnection>;
export type AutomationLogInsert = Insertable<AutomationLog>;

/**
 * Minimal Database type expected by @supabase/supabase-js generic.
 * You can replace this with `supabase gen types typescript` later for full type safety.
 */
export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: Profile;
        Insert: ProfileInsert;
        Update: Partial<ProfileInsert>;
        Relationships: [];
      };
      preferences: {
        Row: Preference;
        Insert: PreferenceInsert;
        Update: Partial<PreferenceInsert>;
        Relationships: [];
      };
      instagram_connections: {
        Row: InstagramConnection;
        Insert: InstagramConnectionInsert;
        Update: Partial<InstagramConnectionInsert>;
        Relationships: [];
      };
      automation_logs: {
        Row: AutomationLog;
        Insert: AutomationLogInsert;
        Update: Partial<AutomationLogInsert>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
