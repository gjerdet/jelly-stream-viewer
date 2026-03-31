
-- 1. Restrict transcode_jobs SELECT to admins only (file_path exposed)
DROP POLICY IF EXISTS "Authenticated users can view transcode jobs" ON public.transcode_jobs;
CREATE POLICY "Admins can view transcode jobs"
  ON public.transcode_jobs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 2. Restrict radarr_movies SELECT to admins only (file_path exposed)
DROP POLICY IF EXISTS "Authenticated users can view radarr_movies" ON public.radarr_movies;
CREATE POLICY "Admins can view radarr_movies"
  ON public.radarr_movies FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- 3. Restrict user_feedback SELECT to own feedback + admins
DROP POLICY IF EXISTS "Authenticated users can view feedback" ON public.user_feedback;
CREATE POLICY "Users can view their own feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all feedback"
  ON public.user_feedback FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));
