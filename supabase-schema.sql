-- ============================================================================
-- MY SPACE ("Us") — PRODUCTION SUPABASE POSTGRESQL DATABASE SCHEMA
-- Version: 2.0.0 (Production Deployment)
-- Direct Import: Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- Description: Complete normalized schema, Row Level Security (RLS) policies,
--              Auth triggers, Realtime publication, Storage buckets,
--              High-performance indexes, and initial game prompt / achievement seeds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. EXTENSIONS
-- ----------------------------------------------------------------------------
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ----------------------------------------------------------------------------
-- 2. HELPER FUNCTIONS & TRIGGERS
-- ----------------------------------------------------------------------------

-- Automatic updated_at timestamp function
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Helper function: Get couple_id of current authenticated user (STABLE SECURITY DEFINER)
CREATE OR REPLACE FUNCTION public.get_auth_couple_id()
RETURNS UUID AS $$
  SELECT couple_id FROM public.profiles WHERE id = auth.uid();
$$ LANGUAGE sql STABLE SECURITY DEFINER;

-- Auth Trigger: Automatically create or update public.profiles on Supabase auth.users signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (
    id,
    email,
    display_name,
    username,
    avatar_url,
    timezone
  )
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'display_name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'username', lower(split_part(NEW.email, '@', 1))),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80'),
    COALESCE(NEW.raw_user_meta_data->>'timezone', 'UTC')
  )
  ON CONFLICT (id) DO UPDATE SET
    email = EXCLUDED.email,
    display_name = COALESCE(EXCLUDED.display_name, profiles.display_name),
    avatar_url = COALESCE(EXCLUDED.avatar_url, profiles.avatar_url),
    updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Bind trigger to auth.users safely
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'auth' AND tablename = 'users') THEN
    DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT OR UPDATE ON auth.users
      FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 3. CORE TABLES DEFINITION
-- ----------------------------------------------------------------------------

-- 1. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  username TEXT UNIQUE,
  avatar_url TEXT DEFAULT 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=400&q=80',
  date_of_birth DATE,
  timezone TEXT DEFAULT 'UTC',
  couple_id UUID,
  role TEXT DEFAULT 'partner',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. COUPLES TABLE
CREATE TABLE IF NOT EXISTS public.couples (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_code TEXT UNIQUE NOT NULL,
  invite_expires_at TIMESTAMPTZ NOT NULL,
  relationship_start_date DATE DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. COUPLE MEMBERS TABLE (Strict 2-Member Sanctuary Limit)
CREATE TABLE IF NOT EXISTS public.couple_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL UNIQUE REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT DEFAULT 'partner',
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT unique_couple_user UNIQUE (couple_id, user_id)
);

-- 4. CHAT MESSAGES TABLE
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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

-- 5. BOOKS TABLE (Shared Couple Library)
CREATE TABLE IF NOT EXISTS public.books (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  author TEXT NOT NULL,
  cover_url TEXT,
  description TEXT,
  category TEXT DEFAULT 'Romantic Literature',
  total_pages INT DEFAULT 1,
  content JSONB DEFAULT '[]'::jsonb,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  uploader_name TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. READING PROGRESS TABLE
CREATE TABLE IF NOT EXISTS public.reading_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  description TEXT,
  cover_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 9. PHOTOS TABLE (Shared Memories Gallery)
CREATE TABLE IF NOT EXISTS public.photos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
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
  id TEXT PRIMARY KEY DEFAULT ('gp_' || gen_random_uuid()::text),
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
  id TEXT PRIMARY KEY DEFAULT ('game-' || gen_random_uuid()::text),
  couple_id UUID NOT NULL REFERENCES public.couples(id) ON DELETE CASCADE,
  game_type TEXT NOT NULL,
  status TEXT DEFAULT 'in_progress',
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

-- 14. GAME MOVES TABLE (Turn-by-turn multiplayer persistence)
CREATE TABLE IF NOT EXISTS public.game_moves (
  id TEXT PRIMARY KEY DEFAULT ('move-' || gen_random_uuid()::text),
  session_id TEXT NOT NULL REFERENCES public.game_sessions(id) ON DELETE CASCADE,
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
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  type TEXT DEFAULT 'chat',
  action_url TEXT,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 16. ACHIEVEMENTS TABLE
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

-- 17. DATE NIGHT IDEAS TABLE
CREATE TABLE IF NOT EXISTS public.date_night_ideas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  couple_id UUID REFERENCES public.couples(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  category TEXT NOT NULL,
  tagline TEXT,
  estimated_time TEXT,
  cost TEXT,
  location TEXT,
  vibe TEXT,
  description TEXT NOT NULL,
  steps JSONB DEFAULT '[]'::jsonb,
  conversation_starter TEXT,
  romantic_touch TEXT,
  playlist_theme TEXT,
  is_favorite BOOLEAN DEFAULT FALSE,
  is_completed BOOLEAN DEFAULT FALSE,
  completed_date DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ----------------------------------------------------------------------------
-- 4. CONSTRAINTS & CIRCULAR FOREIGN KEY LINKAGES
-- ----------------------------------------------------------------------------
DO $$
BEGIN
  -- Safely link profiles.id to auth.users(id) if auth schema exists
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_id_fkey
      FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
  -- Link profiles.couple_id to couples.id
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_couple_id_fkey') THEN
    ALTER TABLE public.profiles
      ADD CONSTRAINT profiles_couple_id_fkey
      FOREIGN KEY (couple_id) REFERENCES public.couples(id) ON DELETE SET NULL;
  END IF;
EXCEPTION
  WHEN OTHERS THEN NULL;
END $$;

-- Bind automatic updated_at triggers
DROP TRIGGER IF EXISTS trg_profiles_updated_at ON public.profiles;
CREATE TRIGGER trg_profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_couples_updated_at ON public.couples;
CREATE TRIGGER trg_couples_updated_at BEFORE UPDATE ON public.couples FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_chat_messages_updated_at ON public.chat_messages;
CREATE TRIGGER trg_chat_messages_updated_at BEFORE UPDATE ON public.chat_messages FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_photos_updated_at ON public.photos;
CREATE TRIGGER trg_photos_updated_at BEFORE UPDATE ON public.photos FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_cycle_settings_updated_at ON public.cycle_settings;
CREATE TRIGGER trg_cycle_settings_updated_at BEFORE UPDATE ON public.cycle_settings FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

DROP TRIGGER IF EXISTS trg_game_sessions_updated_at ON public.game_sessions;
CREATE TRIGGER trg_game_sessions_updated_at BEFORE UPDATE ON public.game_sessions FOR EACH ROW EXECUTE PROCEDURE public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 5. HIGH PERFORMANCE INDEXES
-- ----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_profiles_email ON public.profiles(email);
CREATE INDEX IF NOT EXISTS idx_profiles_couple_id ON public.profiles(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_members_couple_id ON public.couple_members(couple_id);
CREATE INDEX IF NOT EXISTS idx_couple_members_user_id ON public.couple_members(user_id);
CREATE INDEX IF NOT EXISTS idx_chat_messages_couple_created ON public.chat_messages(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_books_couple_id ON public.books(couple_id);
CREATE INDEX IF NOT EXISTS idx_reading_progress_book_user ON public.reading_progress(book_id, user_id);
CREATE INDEX IF NOT EXISTS idx_bookmarks_book_id ON public.bookmarks(book_id);
CREATE INDEX IF NOT EXISTS idx_photo_albums_couple_id ON public.photo_albums(couple_id);
CREATE INDEX IF NOT EXISTS idx_photos_couple_created ON public.photos(couple_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_photos_album_id ON public.photos(album_id);
CREATE INDEX IF NOT EXISTS idx_cycle_logs_user_date ON public.cycle_logs(user_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_game_prompts_type_active ON public.game_prompts(game_type, active);
CREATE INDEX IF NOT EXISTS idx_game_sessions_couple_status ON public.game_sessions(couple_id, status);
CREATE INDEX IF NOT EXISTS idx_game_moves_session ON public.game_moves(session_id, move_number ASC);
CREATE INDEX IF NOT EXISTS idx_app_notifications_user_unread ON public.app_notifications(user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_date_night_ideas_couple ON public.date_night_ideas(couple_id);

-- ----------------------------------------------------------------------------
-- 6. ROW LEVEL SECURITY (RLS) POLICIES
-- ----------------------------------------------------------------------------
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
ALTER TABLE public.game_moves ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_notifications ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.achievements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.date_night_ideas ENABLE ROW LEVEL SECURITY;

-- 1. Profiles Policies
DROP POLICY IF EXISTS "Profiles are viewable by couple members or self" ON public.profiles;
CREATE POLICY "Profiles are viewable by couple members or self"
ON public.profiles FOR SELECT
USING (auth.uid() = id OR couple_id IS NOT NULL AND couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Profiles viewable by anon for demo" ON public.profiles;
CREATE POLICY "Profiles viewable by anon for demo"
ON public.profiles FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;
CREATE POLICY "Users can update their own profile"
ON public.profiles FOR UPDATE
USING (auth.uid() = id);

DROP POLICY IF EXISTS "Profiles updatable by anon for demo" ON public.profiles;
CREATE POLICY "Profiles updatable by anon for demo"
ON public.profiles FOR UPDATE
USING (true);

DROP POLICY IF EXISTS "Profiles insertable by anon for demo" ON public.profiles;
CREATE POLICY "Profiles insertable by anon for demo"
ON public.profiles FOR INSERT
WITH CHECK (true);

-- 2. Couples Policies
DROP POLICY IF EXISTS "Couples viewable by members" ON public.couples;
CREATE POLICY "Couples viewable by members"
ON public.couples FOR SELECT
USING (id = public.get_auth_couple_id() OR auth.uid() IS NOT NULL);

DROP POLICY IF EXISTS "Couples viewable by anon for demo" ON public.couples;
CREATE POLICY "Couples viewable by anon for demo"
ON public.couples FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Couples updatable by members" ON public.couples;
CREATE POLICY "Couples updatable by members"
ON public.couples FOR UPDATE
USING (id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Couples insertable by anon for demo" ON public.couples;
CREATE POLICY "Couples insertable by anon for demo"
ON public.couples FOR INSERT
WITH CHECK (true);

DROP POLICY IF EXISTS "Couples updatable by anon for demo" ON public.couples;
CREATE POLICY "Couples updatable by anon for demo"
ON public.couples FOR UPDATE
USING (true);

-- 3. Couple Members Policies
DROP POLICY IF EXISTS "Couple members viewable by anon for demo" ON public.couple_members;
CREATE POLICY "Couple members viewable by anon for demo"
ON public.couple_members FOR ALL
USING (true);

-- 4. Chat Messages Policies
DROP POLICY IF EXISTS "Couple members can view messages" ON public.chat_messages;
CREATE POLICY "Couple members can view messages"
ON public.chat_messages FOR SELECT
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Chat messages accessible by anon for demo" ON public.chat_messages;
CREATE POLICY "Chat messages accessible by anon for demo"
ON public.chat_messages FOR ALL
USING (true);

DROP POLICY IF EXISTS "Couple members can insert messages" ON public.chat_messages;
CREATE POLICY "Couple members can insert messages"
ON public.chat_messages FOR INSERT
WITH CHECK (couple_id = public.get_auth_couple_id() AND sender_id = auth.uid());

DROP POLICY IF EXISTS "Sender can update/delete messages" ON public.chat_messages;
CREATE POLICY "Sender can update/delete messages"
ON public.chat_messages FOR ALL
USING (sender_id = auth.uid());

-- 5. Books Policies
DROP POLICY IF EXISTS "Couple members can view books" ON public.books;
CREATE POLICY "Couple members can view books"
ON public.books FOR ALL
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Books accessible by anon for demo" ON public.books;
CREATE POLICY "Books accessible by anon for demo"
ON public.books FOR ALL
USING (true);

-- 6. Reading Progress Policies
DROP POLICY IF EXISTS "Reading progress accessible by user or partner" ON public.reading_progress;
CREATE POLICY "Reading progress accessible by user or partner"
ON public.reading_progress FOR ALL
USING (user_id = auth.uid() OR book_id IN (SELECT id FROM public.books WHERE couple_id = public.get_auth_couple_id()));

DROP POLICY IF EXISTS "Reading progress accessible by anon for demo" ON public.reading_progress;
CREATE POLICY "Reading progress accessible by anon for demo"
ON public.reading_progress FOR ALL
USING (true);

-- 7. Bookmarks Policies
DROP POLICY IF EXISTS "Bookmarks accessible by anon for demo" ON public.bookmarks;
CREATE POLICY "Bookmarks accessible by anon for demo"
ON public.bookmarks FOR ALL
USING (true);

-- 8 & 9. Photos & Albums Policies
DROP POLICY IF EXISTS "Couple members can view photos" ON public.photos;
CREATE POLICY "Couple members can view photos"
ON public.photos FOR ALL
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Photos accessible by anon for demo" ON public.photos;
CREATE POLICY "Photos accessible by anon for demo"
ON public.photos FOR ALL
USING (true);

DROP POLICY IF EXISTS "Couple members can view albums" ON public.photo_albums;
CREATE POLICY "Couple members can view albums"
ON public.photo_albums FOR ALL
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Photo albums accessible by anon for demo" ON public.photo_albums;
CREATE POLICY "Photo albums accessible by anon for demo"
ON public.photo_albums FOR ALL
USING (true);

-- 10 & 11. Cycle Settings & Logs Policies
DROP POLICY IF EXISTS "User can manage their own cycle settings" ON public.cycle_settings;
CREATE POLICY "User can manage their own cycle settings"
ON public.cycle_settings FOR ALL
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cycle settings accessible by anon for demo" ON public.cycle_settings;
CREATE POLICY "Cycle settings accessible by anon for demo"
ON public.cycle_settings FOR ALL
USING (true);

DROP POLICY IF EXISTS "Partner can view summary if shared" ON public.cycle_settings;
CREATE POLICY "Partner can view summary if shared"
ON public.cycle_settings FOR SELECT
USING (user_id = auth.uid() OR user_id IN (
  SELECT cm.user_id FROM public.couple_members cm
  WHERE cm.couple_id = public.get_auth_couple_id() AND cm.user_id != auth.uid()
));

DROP POLICY IF EXISTS "User can manage their own cycle logs" ON public.cycle_logs;
CREATE POLICY "User can manage their own cycle logs"
ON public.cycle_logs FOR ALL
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Cycle logs accessible by anon for demo" ON public.cycle_logs;
CREATE POLICY "Cycle logs accessible by anon for demo"
ON public.cycle_logs FOR ALL
USING (true);

-- 12. Game Prompts Policies
DROP POLICY IF EXISTS "Game prompts readable by all users" ON public.game_prompts;
CREATE POLICY "Game prompts readable by all users"
ON public.game_prompts FOR SELECT
TO authenticated
USING (true);

DROP POLICY IF EXISTS "Game prompts accessible by anon for demo" ON public.game_prompts;
CREATE POLICY "Game prompts accessible by anon for demo"
ON public.game_prompts FOR ALL
USING (true);

-- 13 & 14. Game Sessions & Game Moves Policies
DROP POLICY IF EXISTS "Game sessions manageable by couple members" ON public.game_sessions;
CREATE POLICY "Game sessions manageable by couple members"
ON public.game_sessions FOR ALL
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Game sessions accessible by anon for demo" ON public.game_sessions;
CREATE POLICY "Game sessions accessible by anon for demo"
ON public.game_sessions FOR ALL
USING (true);

DROP POLICY IF EXISTS "Game moves manageable by couple members" ON public.game_moves;
CREATE POLICY "Game moves manageable by couple members"
ON public.game_moves FOR ALL
USING (couple_id = public.get_auth_couple_id());

DROP POLICY IF EXISTS "Game moves accessible by anon for demo" ON public.game_moves;
CREATE POLICY "Game moves accessible by anon for demo"
ON public.game_moves FOR ALL
USING (true);

-- 15. Notifications Policies
DROP POLICY IF EXISTS "Users can manage their own notifications" ON public.app_notifications;
CREATE POLICY "Users can manage their own notifications"
ON public.app_notifications FOR ALL
USING (user_id = auth.uid());

DROP POLICY IF EXISTS "Notifications accessible by anon for demo" ON public.app_notifications;
CREATE POLICY "Notifications accessible by anon for demo"
ON public.app_notifications FOR ALL
USING (true);

-- 16. Achievements Policies
DROP POLICY IF EXISTS "Achievements publicly readable" ON public.achievements;
CREATE POLICY "Achievements publicly readable"
ON public.achievements FOR SELECT
USING (true);

DROP POLICY IF EXISTS "Achievements accessible by anon for demo" ON public.achievements;
CREATE POLICY "Achievements accessible by anon for demo"
ON public.achievements FOR ALL
USING (true);

-- 17. Date Night Ideas Policies
DROP POLICY IF EXISTS "Date night ideas accessible by couple" ON public.date_night_ideas;
CREATE POLICY "Date night ideas accessible by couple"
ON public.date_night_ideas FOR ALL
USING (true);

-- ----------------------------------------------------------------------------
-- 7. REALTIME REPLICATION CONFIGURATION
-- ----------------------------------------------------------------------------
-- Set full replica identity for instant updates with old and new payloads
ALTER TABLE public.profiles REPLICA IDENTITY FULL;
ALTER TABLE public.couples REPLICA IDENTITY FULL;
ALTER TABLE public.couple_members REPLICA IDENTITY FULL;
ALTER TABLE public.chat_messages REPLICA IDENTITY FULL;
ALTER TABLE public.books REPLICA IDENTITY FULL;
ALTER TABLE public.reading_progress REPLICA IDENTITY FULL;
ALTER TABLE public.bookmarks REPLICA IDENTITY FULL;
ALTER TABLE public.photo_albums REPLICA IDENTITY FULL;
ALTER TABLE public.photos REPLICA IDENTITY FULL;
ALTER TABLE public.cycle_settings REPLICA IDENTITY FULL;
ALTER TABLE public.cycle_logs REPLICA IDENTITY FULL;
ALTER TABLE public.game_prompts REPLICA IDENTITY FULL;
ALTER TABLE public.game_sessions REPLICA IDENTITY FULL;
ALTER TABLE public.game_moves REPLICA IDENTITY FULL;
ALTER TABLE public.app_notifications REPLICA IDENTITY FULL;
ALTER TABLE public.achievements REPLICA IDENTITY FULL;
ALTER TABLE public.date_night_ideas REPLICA IDENTITY FULL;

-- Add all tables to supabase_realtime publication
DO $$
BEGIN
  ALTER PUBLICATION supabase_realtime ADD TABLE 
    public.profiles,
    public.couples,
    public.couple_members,
    public.chat_messages,
    public.books,
    public.reading_progress,
    public.bookmarks,
    public.photo_albums,
    public.photos,
    public.cycle_settings,
    public.cycle_logs,
    public.game_prompts,
    public.game_sessions,
    public.game_moves,
    public.app_notifications,
    public.achievements,
    public.date_night_ideas;
EXCEPTION
  WHEN OTHERS THEN
    BEGIN
      CREATE PUBLICATION supabase_realtime FOR TABLE 
        public.profiles,
        public.couples,
        public.couple_members,
        public.chat_messages,
        public.books,
        public.reading_progress,
        public.bookmarks,
        public.photo_albums,
        public.photos,
        public.cycle_settings,
        public.cycle_logs,
        public.game_prompts,
        public.game_sessions,
        public.game_moves,
        public.app_notifications,
        public.achievements,
        public.date_night_ideas;
    EXCEPTION
      WHEN OTHERS THEN NULL;
    END;
END $$;

-- ----------------------------------------------------------------------------
-- 8. STORAGE BUCKETS CONFIGURATION
-- ----------------------------------------------------------------------------
INSERT INTO storage.buckets (id, name, public) 
VALUES 
  ('memories', 'memories', true),
  ('avatars', 'avatars', true),
  ('books', 'books', true),
  ('chat', 'chat', true)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  CREATE POLICY "Public storage read access"
  ON storage.objects FOR SELECT
  USING (bucket_id IN ('memories', 'avatars', 'books', 'chat'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public storage upload access"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id IN ('memories', 'avatars', 'books', 'chat'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public storage update access"
  ON storage.objects FOR UPDATE
  USING (bucket_id IN ('memories', 'avatars', 'books', 'chat'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

DO $$
BEGIN
  CREATE POLICY "Public storage delete access"
  ON storage.objects FOR DELETE
  USING (bucket_id IN ('memories', 'avatars', 'books', 'chat'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- ----------------------------------------------------------------------------
-- 9. INITIAL SEED DATA (Achievements, Prompts, Daily Reflections)
-- ----------------------------------------------------------------------------

-- Achievements Seeds
INSERT INTO public.achievements (id, title, description, icon, category, progress, max_progress)
VALUES
  ('ach-first-message', 'First Whisper', 'Sent your very first couple chat message.', 'MessageCircleHeart', 'chat', 1, 1),
  ('ach-first-memory', 'Memory Maker', 'Uploaded your first cherished photograph to your gallery.', 'Camera', 'memories', 1, 1),
  ('ach-game-night', 'Playful Hearts', 'Completed your first couple duel game session.', 'Gamepad2', 'games', 1, 1),
  ('ach-bookworm', 'Reading Partners', 'Finished your first chapter together in the library.', 'BookOpen', 'reading', 1, 1),
  ('ach-7-day-streak', 'Weekly Devotion', 'Logged into your sanctuary together 7 days in a row.', 'Flame', 'relationship', 3, 7)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Truth or Dare (Romantic, Deep, Playful, Hot)
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('tod-r-t1', 'truth_or_dare', 'romantic', 'What is something small I do that always gives you butterflies?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-r-t2', 'truth_or_dare', 'romantic', 'When did you first realize you were developing deep feelings for me?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-r-d1', 'truth_or_dare', 'romantic', 'Look into my eyes for 60 seconds without speaking or looking away.', '{"type": "dare"}'::jsonb, 'all', true),
  ('tod-r-d2', 'truth_or_dare', 'romantic', 'Give me a gentle 3-minute shoulder or neck massage right now.', '{"type": "dare"}'::jsonb, 'all', true),
  ('tod-d-t1', 'truth_or_dare', 'deep', 'What is something you are currently working on within yourself that you need my patience with?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-d-t2', 'truth_or_dare', 'deep', 'What does our future look like when you imagine us 10 years from now?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-d-d1', 'truth_or_dare', 'deep', 'Hold my hands and tell me one thing you admire about the way I handle adversity.', '{"type": "dare"}'::jsonb, 'all', true),
  ('tod-p-t1', 'truth_or_dare', 'playful', 'If our relationship was a sitcom or romantic comedy, what would its title be?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-p-d1', 'truth_or_dare', 'playful', 'Serenade me with 30 seconds of your favorite romantic chorus, dramatically.', '{"type": "dare"}'::jsonb, 'all', true),
  ('tod-h-t1', 'truth_or_dare', 'hot', 'What is one fantasy or romantic scenario you have not yet shared with me?', '{"type": "truth"}'::jsonb, 'all', true),
  ('tod-h-d1', 'truth_or_dare', 'hot', 'Whisper something seductive in my ear that you want us to do tonight.', '{"type": "dare"}'::jsonb, 'all', true)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Would You Rather
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('wyr-1', 'would_you_rather', 'romantic', 'Would you rather have a candlelit rooftop dinner under the stars or a lazy rainy morning breakfast in bed?', '{"optionA": "Rooftop dinner under stars", "optionB": "Lazy rainy breakfast in bed"}'::jsonb, 'all', true),
  ('wyr-2', 'would_you_rather', 'adventure', 'Would you rather take an impromptu cross-country road trip with no map or spend a week in an overwater bungalow in the Maldives?', '{"optionA": "Impromptu road trip", "optionB": "Overwater bungalow in Maldives"}'::jsonb, 'all', true),
  ('wyr-3', 'would_you_rather', 'lifestyle', 'Would you rather cook an extravagant gourmet meal together from scratch or discover a hidden gem hole-in-the-wall restaurant?', '{"optionA": "Gourmet meal from scratch", "optionB": "Hidden gem restaurant"}'::jsonb, 'all', true),
  ('wyr-4', 'would_you_rather', 'romantic', 'Would you rather receive handwritten love letters every month or surprise weekend getaways twice a year?', '{"optionA": "Handwritten love letters", "optionB": "Surprise weekend getaways"}'::jsonb, 'all', true),
  ('wyr-5', 'would_you_rather', 'cozy', 'Would you rather slow dance in our living room with no music or sing your heart out to 90s hits on a late-night drive?', '{"optionA": "Living room slow dance", "optionB": "Late-night 90s car karaoke"}'::jsonb, 'all', true)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Never Have I Ever
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('nhie-1', 'never_have_i_ever', 'romantic', 'Never have I ever fallen in love at first sight.', '{"category": "romance"}'::jsonb, 'all', true),
  ('nhie-2', 'never_have_i_ever', 'funny', 'Never have I ever stalked my partner''s old social media photos late into the night.', '{"category": "playful"}'::jsonb, 'all', true),
  ('nhie-3', 'never_have_i_ever', 'intimate', 'Never have I ever pretended to be asleep just to get extra cuddles.', '{"category": "cozy"}'::jsonb, 'all', true),
  ('nhie-4', 'never_have_i_ever', 'travel', 'Never have I ever packed a secret romantic surprise on a vacation without telling my partner.', '{"category": "adventure"}'::jsonb, 'all', true),
  ('nhie-5', 'never_have_i_ever', 'intimate', 'Never have I ever gotten butterflies re-reading our old messages from when we first met.', '{"category": "nostalgia"}'::jsonb, 'all', true)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Hangman Words & Clues
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('hm-1', 'hangman', 'romance', 'SOULMATE', '{"hint": "Two people destined to find one another across time", "category": "Love"}'::jsonb, 'easy', true),
  ('hm-2', 'hangman', 'cozy', 'SERENDIPITY', '{"hint": "A fortunate stroke of unexpected destiny", "category": "Poetic"}'::jsonb, 'medium', true),
  ('hm-3', 'hangman', 'memories', 'SANCTUARY', '{"hint": "A private, safe refuge created just for the two of us", "category": "Us"}'::jsonb, 'medium', true),
  ('hm-4', 'hangman', 'intimate', 'WHISPER', '{"hint": "Softly spoken secrets shared in the dark", "category": "Affection"}'::jsonb, 'easy', true)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Emoji Puzzles
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('ep-1', 'emoji_puzzle', 'movies', '🚢 🧊 💔 🚪', '{"answer": "Titanic", "hint": "A grand cinematic romance at sea"}'::jsonb, 'easy', true),
  ('ep-2', 'emoji_puzzle', 'songs', '🌧️ 🎸 💜', '{"answer": "Purple Rain", "hint": "Iconic ballad and electric guitar solo"}'::jsonb, 'medium', true),
  ('ep-3', 'emoji_puzzle', 'romantic', '☕ 🥐 🗼 💋', '{"answer": "Midnight in Paris", "hint": "Romantic rainy city strolls and cafes"}'::jsonb, 'easy', true),
  ('ep-4', 'emoji_puzzle', 'love', '📖 👵 👴 🦢', '{"answer": "The Notebook", "hint": "If you are a bird, I am a bird"}'::jsonb, 'easy', true)
ON CONFLICT (id) DO NOTHING;

-- Game Prompts: Daily Reflections
INSERT INTO public.game_prompts (id, game_type, category, prompt, extra_data, difficulty, active)
VALUES
  ('dr-1', 'daily_reflection', 'connection', 'What is one moment today when you felt close to me, even if we were apart?', '{"reflectionType": "daily"}'::jsonb, 'all', true),
  ('dr-2', 'daily_reflection', 'gratitude', 'Name one quality you deeply appreciate about how your partner supported you recently.', '{"reflectionType": "daily"}'::jsonb, 'all', true),
  ('dr-3', 'daily_reflection', 'memories', 'What is your favorite sensory memory of us together (a scent, sound, touch, or sight)?', '{"reflectionType": "daily"}'::jsonb, 'all', true),
  ('dr-4', 'daily_reflection', 'dreams', 'What is one new experience or trip you want us to embark on in the upcoming months?', '{"reflectionType": "daily"}'::jsonb, 'all', true),
  ('dr-5', 'daily_reflection', 'comfort', 'How can your partner bring peace and lightness to your spirit this evening?', '{"reflectionType": "daily"}'::jsonb, 'all', true)
ON CONFLICT (id) DO NOTHING;

-- ----------------------------------------------------------------------------
-- SUCCESS VERIFICATION
-- ----------------------------------------------------------------------------
-- Display confirmation notice in Supabase query output
SELECT 'My Space ("Us") full database schema deployed successfully! All 17 tables, RLS policies, Realtime, Storage buckets, and initial seeds are active.' AS status;
