-- Create table for synced Radarr movies
CREATE TABLE IF NOT EXISTS public.radarr_movies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  radarr_id INTEGER NOT NULL UNIQUE,
  tmdb_id INTEGER,
  title TEXT NOT NULL,
  year INTEGER,
  quality_profile TEXT,
  has_file BOOLEAN DEFAULT false,
  file_path TEXT,
  file_size_bytes BIGINT,
  video_codec TEXT,
  audio_codec TEXT,
  resolution TEXT,
  status TEXT,
  monitored BOOLEAN DEFAULT true,
  added_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for synced Sonarr series
CREATE TABLE IF NOT EXISTS public.sonarr_series (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sonarr_id INTEGER NOT NULL UNIQUE,
  tvdb_id INTEGER,
  title TEXT NOT NULL,
  year INTEGER,
  quality_profile TEXT,
  status TEXT,
  monitored BOOLEAN DEFAULT true,
  episode_count INTEGER DEFAULT 0,
  episode_file_count INTEGER DEFAULT 0,
  size_on_disk_bytes BIGINT,
  added_at TIMESTAMP WITH TIME ZONE,
  synced_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create table for sync schedule configuration
CREATE TABLE IF NOT EXISTS public.sync_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sync_type TEXT NOT NULL UNIQUE,
  cron_expression TEXT NOT NULL DEFAULT '0 2 * * *',
  enabled BOOLEAN DEFAULT true,
  last_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  last_run_details JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.radarr_movies ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sonarr_series ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sync_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies - admins can manage, authenticated users can view
CREATE POLICY "Admins can manage radarr_movies"
ON public.radarr_movies FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view radarr_movies"
ON public.radarr_movies FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage sonarr_series"
ON public.sonarr_series FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view sonarr_series"
ON public.sonarr_series FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage sync_schedule"
ON public.sync_schedule FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Authenticated users can view sync_schedule"
ON public.sync_schedule FOR SELECT
TO authenticated
USING (true);

-- Insert default sync schedules
INSERT INTO public.sync_schedule (sync_type, cron_expression, enabled) VALUES
  ('jellyfin_users', '0 3 * * *', true),
  ('jellyfin_history', '0 4 * * *', true),
  ('radarr_library', '0 2 * * *', true),
  ('sonarr_library', '0 2 * * *', true)
ON CONFLICT (sync_type) DO NOTHING;

-- Triggers for updated_at
CREATE TRIGGER update_radarr_movies_updated_at
  BEFORE UPDATE ON public.radarr_movies
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sonarr_series_updated_at
  BEFORE UPDATE ON public.sonarr_series
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_sync_schedule_updated_at
  BEFORE UPDATE ON public.sync_schedule
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();