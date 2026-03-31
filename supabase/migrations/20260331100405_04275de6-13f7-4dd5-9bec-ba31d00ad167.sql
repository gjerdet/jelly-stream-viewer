
-- 1. Remove the dangerous public SELECT policy on server_settings
DROP POLICY IF EXISTS "Everyone can read server settings" ON public.server_settings;

-- 2. Restrict transcode_jobs SELECT to authenticated users only
DROP POLICY IF EXISTS "Everyone can view transcode jobs" ON public.transcode_jobs;
CREATE POLICY "Authenticated users can view transcode jobs"
  ON public.transcode_jobs
  FOR SELECT
  TO authenticated
  USING (true);

-- 3. Restrict radarr_downloads SELECT to authenticated users only
DROP POLICY IF EXISTS "Everyone can view radarr downloads" ON public.radarr_downloads;
CREATE POLICY "Authenticated users can view radarr downloads"
  ON public.radarr_downloads
  FOR SELECT
  TO authenticated
  USING (true);

-- 4. Restrict user_feedback SELECT to authenticated users only
DROP POLICY IF EXISTS "Anyone can view feedback" ON public.user_feedback;
CREATE POLICY "Authenticated users can view feedback"
  ON public.user_feedback
  FOR SELECT
  TO authenticated
  USING (true);
