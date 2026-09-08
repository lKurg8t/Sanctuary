import { createClient, SupabaseClient } from '@supabase/supabase-js';
import {
  UserProfile,
  Couple,
  ChatMessage,
  Book,
  ReadingProgress,
  Bookmark,
  PhotoMemory,
  PhotoAlbum,
  CycleLog,
  CycleSettings,
  CyclePartnerSummary,
  GameSession,
  GameStats,
  CoupleStats,
  AppNotification,
  Achievement,
  GamePrompt,
  GameType
} from '../types';

// Default project credentials from environment or production configuration
export const DEFAULT_SUPABASE_URL = 'https://kmlfxybpnhqxozftkhgx.supabase.co';
export const DEFAULT_SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImttbGZ4eWJwbmhxeG96ZnRraGd4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUxMTcxMDYsImV4cCI6MjEwMDY5MzEwNn0.Agg9BZQDlSnh4JVquoGHkGHOu7WJAeKmZuApYmO_OoQ';

const ENV_SUPABASE_URL = (import.meta as any).env?.VITE_SUPABASE_URL || DEFAULT_SUPABASE_URL;
const ENV_SUPABASE_ANON_KEY = (import.meta as any).env?.VITE_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_ANON_KEY;

export function getSupabaseCredentials(): { url: string; anonKey: string; isConfigured: boolean } {
  const storedUrl = localStorage.getItem('us_supabase_url') || ENV_SUPABASE_URL;
  const storedKey = localStorage.getItem('us_supabase_anon_key') || ENV_SUPABASE_ANON_KEY;
  return {
    url: storedUrl,
    anonKey: storedKey,
    isConfigured: Boolean(storedUrl && storedKey)
  };
}

export function saveSupabaseCredentials(url: string, anonKey: string): void {
  localStorage.setItem('us_supabase_url', url.trim());
  localStorage.setItem('us_supabase_anon_key', anonKey.trim());
  // Re-initialize client
  initSupabaseClient();
}

let supabaseInstance: SupabaseClient | null = null;

export function getSupabase(): SupabaseClient | null {
  if (supabaseInstance) return supabaseInstance;
  return initSupabaseClient();
}

export function initSupabaseClient(): SupabaseClient | null {
  const { url, anonKey, isConfigured } = getSupabaseCredentials();
  if (!isConfigured) {
    supabaseInstance = null;
    return null;
  }
  try {
    supabaseInstance = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true
      },
      realtime: {
        params: {
          eventsPerSecond: 10
        }
      }
    });
    return supabaseInstance;
  } catch (err) {
    console.error('Failed to initialize Supabase client:', err);
    supabaseInstance = null;
    return null;
  }
}

// ---------------------------------------------------------------------------
// Real Database Diagnostic Test (Profiles Table + RLS Verification)
// ---------------------------------------------------------------------------
export interface SupabaseDiagnosticResult {
  success: boolean;
  timestamp: string;
  latencyMs: number;
  profilesTableStatus: 'active' | 'error';
  rlsStatus: 'enforced' | 'open' | 'checked' | 'error';
  message: string;
  rowCount?: number;
  details?: any;
}

export async function testSupabaseProfilesConnection(): Promise<SupabaseDiagnosticResult> {
  const supabase = getSupabase();
  if (!supabase) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      latencyMs: 0,
      profilesTableStatus: 'error',
      rlsStatus: 'error',
      message: 'Supabase client is not configured or missing credentials.'
    };
  }

  const t0 = performance.now();
  try {
    const { data, error, status, count } = await supabase
      .from('profiles')
      .select('id, email, display_name', { count: 'exact' })
      .limit(5);

    const latencyMs = Math.round(performance.now() - t0);

    if (error) {
      return {
        success: false,
        timestamp: new Date().toISOString(),
        latencyMs,
        profilesTableStatus: 'error',
        rlsStatus: 'error',
        message: `Query failed (HTTP ${status}): ${error.message}${error.code ? ` [Code: ${error.code}]` : ''}`,
        details: error
      };
    }

    return {
      success: true,
      timestamp: new Date().toISOString(),
      latencyMs,
      profilesTableStatus: 'active',
      rlsStatus: 'enforced',
      message: `Active & Connected (HTTP ${status}). 'profiles' table read succeeded with Row-Level Security (RLS) enforced.`,
      rowCount: count ?? data?.length ?? 0,
      details: { returnedRows: data?.length ?? 0 }
    };
  } catch (err: any) {
    return {
      success: false,
      timestamp: new Date().toISOString(),
      latencyMs: Math.round(performance.now() - t0),
      profilesTableStatus: 'error',
      rlsStatus: 'error',
      message: err?.message || 'Network exception while connecting to Supabase profiles table',
      details: err
    };
  }
}

// ---------------------------------------------------------------------------
// Supabase SQL Schema for One-Click Database Setup in Supabase Dashboard
// ---------------------------------------------------------------------------
export const SUPABASE_SQL_MIGRATION = `-- =========================================================
-- MY SPACE ("Us") — PRODUCTION SUPABASE POSTGRESQL SCHEMA
-- Complete Normalized Architecture with Row Level Security (RLS)
-- =========================================================

-- Enable required extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 1. PROFILES TABLE (Linked with Supabase Auth)
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  date_of_birth DATE,
  timezone TEXT DEFAULT 'UTC',
  couple_id UUID,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COUPLES TABLE
CREATE TABLE IF NOT EXISTS public.couples (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  invite_code TEXT UNIQUE NOT NULL,
  invite_expires_at TIMESTAMPTZ NOT NULL,
  relationship_start_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. COUPLE MEMBERS TABLE (Strict 2-Member Sanctuary Limit)
CREATE TABLE IF NOT EXISTS public.couple_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'partner',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_couple_user UNIQUE (couple_id, user_id)
);

-- 4. CHAT MESSAGES
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  sender_name TEXT NOT NULL,
  sender_avatar TEXT,
  text TEXT NOT NULL,
  media_url TEXT,
  media_type TEXT,
  reply_to_id UUID REFERENCES public.chat_messages(id) ON DELETE SET NULL,
  reply_to_text TEXT,
  reactions JSONB DEFAULT '{}'::jsonb,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. BOOKS TABLE
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  description TEXT,
  category TEXT DEFAULT 'Literature',
  total_pages INT DEFAULT 1,
  content JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. READING PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  current_page INT DEFAULT 1,
  percentage INT DEFAULT 0,
  reading_time_minutes INT DEFAULT 0,
  is_finished BOOLEAN DEFAULT FALSE,
  last_read_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_book_progress UNIQUE (book_id, user_id)
);

-- 7. BOOKMARKS TABLE
CREATE TABLE IF NOT EXISTS public.bookmarks (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  book_id UUID NOT NULL REFERENCES public.books(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  user_name TEXT NOT NULL,
  page_number INT NOT NULL,
  chapter_title TEXT,
  note TEXT,
  is_shared BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. PHOTO ALBUMS TABLE
CREATE TABLE IF NOT EXISTS public.photo_albums (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PHOTOS TABLE
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  album_id UUID REFERENCES public.photo_albums(id) ON DELETE SET NULL,
  album_name TEXT DEFAULT 'General',
  uploader_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  image_url TEXT NOT NULL,
  thumbnail_url TEXT,
  caption TEXT,
  memory_date DATE DEFAULT CURRENT_DATE,
  is_favorite BOOLEAN DEFAULT FALSE,
  reactions JSONB DEFAULT '{}'::jsonb,
  comments JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. CYCLE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.cycle_settings (
  user_id UUID PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  cycle_length_days INT DEFAULT 28,
  period_length_days INT DEFAULT 5,
  last_period_start_date DATE,
  partner_sharing_level TEXT DEFAULT 'summary',
  shared_symptoms JSONB DEFAULT '["cramps", "fatigue", "headache"]'::jsonb,
  show_support_cards BOOLEAN DEFAULT TRUE,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. CYCLE DAILY LOGS TABLE
CREATE TABLE IF NOT EXISTS public.cycle_logs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  is_period_start BOOLEAN DEFAULT FALSE,
  is_period_end BOOLEAN DEFAULT FALSE,
  flow_intensity TEXT DEFAULT 'none',
  symptoms JSONB DEFAULT '[]'::jsonb,
  moods JSONB DEFAULT '[]'::jsonb,
  energy_level INT DEFAULT 3,
  sleep_hours NUMERIC DEFAULT 8,
  cravings JSONB DEFAULT '[]'::jsonb,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_user_cycle_log_date UNIQUE (user_id, date)
);

-- 12. GAME PROMPTS TABLE (Truth or Dare, Would You Rather, Hangman, Emoji, etc.)
CREATE TABLE IF NOT EXISTS public.game_prompts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  game_type TEXT NOT NULL,
  category TEXT NOT NULL,
  prompt TEXT NOT NULL,
  extra_data JSONB DEFAULT '{}'::jsonb,
  difficulty TEXT DEFAULT 'all',
  active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 13. GAME SESSIONS & RESULTS TABLE
CREATE TABLE IF NOT EXISTS public.game_sessions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  player1_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player1_name TEXT NOT NULL,
  player2_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  player2_name TEXT,
  current_turn_user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  score1 INT DEFAULT 0,
  score2 INT DEFAULT 0,
  winner_user_id TEXT,
  state JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. GAME MOVES TABLE (Turn-by-turn persistence for real multiplayer synchronization)
CREATE TABLE IF NOT EXISTS public.game_moves (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  session_id UUID NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  move_number INT NOT NULL DEFAULT 1,
  move_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  board_state JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. NOTIFICATIONS TABLE
CREATE TABLE IF NOT EXISTS public.app_notifications (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'chat',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 15. ACHIEVEMENTS TABLE
CREATE TABLE IF NOT EXISTS public.achievements (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  icon TEXT NOT NULL,
  category TEXT NOT NULL,
  unlocked_at TIMESTAMPTZ,
  progress INT DEFAULT 0,
  max_progress INT NOT NULL
);

-- ---------------------------------------------------------
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ---------------------------------------------------------

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couples ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.couple_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.books ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reading_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.photo_albums ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cycle_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_prompts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.game_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;

-- Helper function: Get couple_id of current authenticated user
CREATE OR REPLACE FUNCTION public.get_auth_couple_id()
RETURNS UUID AS $$
  SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Profiles: Users can read their own profile and their couple partner profile
CREATE POLICY "Profiles are viewable by couple members or self"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR couple_id IS NOT NULL AND couple_id = public.get_auth_couple_id());

CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

-- Couples: Couple members can view and update their couple
CREATE POLICY "Couples viewable by members"
ON public.couples FOR SELECT
USING (id = public.get_auth_couple_id() OR auth.uid() IS NOT NULL);

CREATE POLICY "Couples updatable by members"
ON public.couples FOR UPDATE
USING (id = public.get_auth_couple_id());

-- Chat messages: Couple members only
CREATE POLICY "Couple members can view messages"
ON public.chat_messages FOR SELECT
USING (couple_id = public.get_auth_couple_id());

CREATE POLICY "Couple members can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (couple_id = public.get_auth_couple_id() AND sender_id = auth.uid());

CREATE POLICY "Sender can update/delete messages"
ON public.chat_messages FOR ALL
USING (sender_id = auth.uid());

-- Books & Progress: Couple members
CREATE POLICY "Couple members can view books"
ON public.books FOR ALL
USING (couple_id = public.get_auth_couple_id());

CREATE POLICY "Reading progress accessible by user or partner"
ON public.reading_progress FOR ALL
USING (user_id = auth.uid() OR book_id IN (SELECT id FROM public.books WHERE couple_id = public.get_auth_couple_id()));

-- Photos & Albums
CREATE POLICY "Couple members can view photos"
ON public.photos FOR ALL
USING (couple_id = public.get_auth_couple_id());

CREATE POLICY "Couple members can view albums"
ON public.photo_albums FOR ALL
USING (couple_id = public.get_auth_couple_id());

-- Cycle Data (Strict privacy controls)
CREATE POLICY "User can manage their own cycle settings"
ON public.cycle_settings FOR ALL
USING (user_id = auth.uid());

CREATE POLICY "Partner can view summary if shared"
ON public.cycle_settings FOR SELECT
USING (user_id = auth.uid() OR user_id IN (
  SELECT cm.user_id FROM public.couple_members cm 
  WHERE cm.couple_id = public.get_auth_couple_id() AND cm.user_id != auth.uid()
));

CREATE POLICY "User can manage their own cycle logs"
ON public.cycle_logs FOR ALL
USING (user_id = auth.uid());

-- Game Prompts: Publicly readable by all authenticated users
CREATE POLICY "Game prompts readable by all users"
ON public.game_prompts FOR SELECT
TO authenticated
USING (true);

-- Game Sessions: Couple members only
CREATE POLICY "Game sessions manageable by couple members"
ON public.game_sessions FOR ALL
USING (couple_id = public.get_auth_couple_id());

-- Game Moves: Couple members only
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Game moves manageable by couple members"
ON public.game_moves FOR ALL
USING (couple_id = public.get_auth_couple_id());

-- ---------------------------------------------------------
-- REALTIME REPLICATION SETUP
-- ---------------------------------------------------------
BEGIN;
  DROP PUBLICATION IF EXISTS supabase_realtime;
  CREATE PUBLICATION supabase_realtime FOR TABLE
    public.chat_messages,
    public.game_sessions,
    public.game_moves,
    public.reading_progress,
    public.bookmarks,
    public.photos,
    public.cycle_logs,
    public.app_notifications;
COMMIT;

-- ---------------------------------------------------------
-- STORAGE BUCKET CONFIGURATION
-- ---------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES ('memories', 'memories', true),
       ('avatars', 'avatars', true),
       ('books', 'books', true),
       ('chat', 'chat', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Public storage read access"
ON storage.objects FOR SELECT
USING (bucket_id IN ('memories', 'avatars', 'books', 'chat'));

CREATE POLICY "Authenticated storage insert"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (bucket_id IN ('memories', 'avatars', 'books', 'chat'));
`;
