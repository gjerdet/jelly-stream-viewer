-- ============================================
-- JELLY STREAM VIEWER - DATABASE SETUP
-- ============================================
-- Dette scriptet setter opp hele databasen for selvhosting
-- Kjør dette i din egen Supabase SQL Editor
--
-- Viktig: Dette scriptet må kjøres på en tom database!
-- ============================================

-- ============================================
-- 1. ENUMS
-- ============================================

-- Create app_role enum
CREATE TYPE public.app_role AS ENUM ('admin', 'user');

-- ============================================
-- 2. TABELLER
-- ============================================

-- Create profiles table
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  jellyfin_username TEXT,
  jellyfin_user_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Create user_roles table
CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role app_role NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Create server_settings table for Jellyfin configuration
CREATE TABLE public.server_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT UNIQUE NOT NULL,
  setting_value TEXT NOT NULL,
  updated_by UUID REFERENCES auth.users(id),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE public.server_settings ENABLE ROW LEVEL SECURITY;

-- Create watch history table
CREATE TABLE public.watch_history (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_season_id TEXT,
  jellyfin_series_id TEXT,
  jellyfin_series_name TEXT,
  image_url TEXT,
  watched_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  last_position_ticks BIGINT DEFAULT 0,
  runtime_ticks BIGINT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.watch_history ENABLE ROW LEVEL SECURITY;

-- Create table for user favorites
CREATE TABLE public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, jellyfin_item_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Create table for user likes
CREATE TABLE public.user_likes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  jellyfin_item_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, jellyfin_item_id)
);

ALTER TABLE public.user_likes ENABLE ROW LEVEL SECURITY;

-- Create site_settings table
CREATE TABLE public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Create news_posts table
CREATE TABLE public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  pinned BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

-- Create version management table
CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number TEXT NOT NULL UNIQUE,
  release_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  description TEXT,
  changelog TEXT,
  is_current BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Create table for Jellyseerr requests
CREATE TABLE public.jellyseerr_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  media_type TEXT NOT NULL CHECK (media_type IN ('movie', 'tv')),
  media_id INTEGER NOT NULL,
  seasons JSONB,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  media_title TEXT NOT NULL,
  media_poster TEXT,
  media_overview TEXT,
  rejection_reason TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  approved_at TIMESTAMP WITH TIME ZONE,
  approved_by UUID REFERENCES auth.users(id)
);

ALTER TABLE public.jellyseerr_requests ENABLE ROW LEVEL SECURITY;

-- ============================================
-- 3. INDEXES
-- ============================================

CREATE INDEX idx_watch_history_user_watched ON public.watch_history(user_id, watched_at DESC);
CREATE INDEX idx_watch_history_item ON public.watch_history(jellyfin_item_id, user_id);
CREATE INDEX idx_news_posts_pinned_created ON public.news_posts (pinned DESC, created_at DESC);
CREATE INDEX idx_jellyseerr_requests_status ON public.jellyseerr_requests(status);
CREATE INDEX idx_jellyseerr_requests_user_id ON public.jellyseerr_requests(user_id);

-- ============================================
-- 4. FUNKSJONER
-- ============================================

-- Create security definer function to check roles
CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE SQL
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Create function to update timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Create function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, jellyfin_username, jellyfin_user_id)
  VALUES (
    NEW.id, 
    NEW.email,
    NEW.raw_user_meta_data->>'jellyfin_username',
    NEW.raw_user_meta_data->>'jellyfin_user_id'
  );
  
  -- First user becomes admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'admin');
  ELSE
    INSERT INTO public.user_roles (user_id, role)
    VALUES (NEW.id, 'user');
  END IF;
  
  RETURN NEW;
END;
$$;

-- Setup function for initial server configuration (optional, for convenience)
CREATE OR REPLACE FUNCTION public.setup_server_settings(p_server_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Upsert server URL
  INSERT INTO server_settings (setting_key, setting_value, updated_at)
  VALUES ('jellyfin_server_url', p_server_url, now())
  ON CONFLICT (setting_key)
  DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    updated_at = now();

  -- Upsert API key
  INSERT INTO server_settings (setting_key, setting_value, updated_at)
  VALUES ('jellyfin_api_key', p_api_key, now())
  ON CONFLICT (setting_key)
  DO UPDATE SET 
    setting_value = EXCLUDED.setting_value,
    updated_at = now();
END;
$$;

-- ============================================
-- 5. TRIGGERS
-- ============================================

-- Trigger for new user registration
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Trigger for updating watch_history timestamps
CREATE TRIGGER update_watch_history_updated_at
  BEFORE UPDATE ON public.watch_history
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Trigger for updating news_posts timestamps
CREATE TRIGGER update_news_posts_updated_at
  BEFORE UPDATE ON public.news_posts
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- 6. ROW LEVEL SECURITY POLICIES
-- ============================================

-- RLS Policies for profiles
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (auth.uid() = id);

CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for server_settings
CREATE POLICY "Everyone can read server settings"
  ON public.server_settings FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Only admins can update server settings"
  ON public.server_settings FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert server settings"
  ON public.server_settings FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- RLS Policies for watch_history
CREATE POLICY "Users can view their own watch history" 
  ON public.watch_history 
  FOR SELECT 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own watch history" 
  ON public.watch_history 
  FOR INSERT 
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own watch history" 
  ON public.watch_history 
  FOR UPDATE 
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own watch history" 
  ON public.watch_history 
  FOR DELETE 
  USING (auth.uid() = user_id);

-- RLS Policies for user_favorites
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorites
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own favorites"
  ON public.user_favorites
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own favorites"
  ON public.user_favorites
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for user_likes
CREATE POLICY "Users can view their own likes"
  ON public.user_likes
  FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own likes"
  ON public.user_likes
  FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete their own likes"
  ON public.user_likes
  FOR DELETE
  USING (auth.uid() = user_id);

-- RLS Policies for site_settings
CREATE POLICY "Everyone can read site settings"
  ON public.site_settings
  FOR SELECT
  USING (true);

CREATE POLICY "Only admins can update site settings"
  ON public.site_settings
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Only admins can insert site settings"
  ON public.site_settings
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

-- RLS Policies for news_posts
CREATE POLICY "Everyone can read published posts"
  ON public.news_posts
  FOR SELECT
  USING (published = true);

CREATE POLICY "Admins can view all posts"
  ON public.news_posts
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can create posts"
  ON public.news_posts
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update posts"
  ON public.news_posts
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete posts"
  ON public.news_posts
  FOR DELETE
  USING (has_role(auth.uid(), 'admin'));

-- RLS Policies for app_versions
CREATE POLICY "Admins can manage versions"
  ON public.app_versions
  FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view versions"
  ON public.app_versions
  FOR SELECT
  USING (true);

-- RLS Policies for jellyseerr_requests
CREATE POLICY "Users can create their own requests"
  ON public.jellyseerr_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own requests"
  ON public.jellyseerr_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all requests"
  ON public.jellyseerr_requests
  FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update requests"
  ON public.jellyseerr_requests
  FOR UPDATE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete requests"
  ON public.jellyseerr_requests
  FOR DELETE
  TO authenticated
  USING (has_role(auth.uid(), 'admin'));

-- ============================================
-- 7. INITIAL DATA (VALGFRITT)
-- ============================================

-- Insert default site settings (kan tilpasses etter behov)
INSERT INTO public.site_settings (setting_key, setting_value) VALUES
  ('site_name', 'Jelly Stream Viewer'),
  ('site_logo_url', ''),
  ('site_header_title', 'Jelly Stream Viewer')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert initial app version
INSERT INTO public.app_versions (version_number, description, changelog, is_current)
VALUES ('1.0.0', 'Initial release', 'First stable version of Jelly Stream Viewer', true)
ON CONFLICT (version_number) DO NOTHING;

-- ============================================
-- SETUP FERDIG!
-- ============================================
-- Neste steg:
-- 1. Gå til Supabase Dashboard -> Authentication -> Providers
-- 2. Aktiver Email provider og skru AV "Confirm email"
-- 3. Kopier API keys til .env filen
-- 4. Konfigurer Jellyfin i applikasjonen via /setup ruten
-- ============================================
