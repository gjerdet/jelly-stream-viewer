-- ============================================
-- RLS POLICIES DOCUMENTATION
-- ============================================
-- This file documents all Row-Level Security policies
-- in the Jelly Stream Viewer database.
-- 
-- IMPORTANT: These policies are already applied via migrations.
-- This file serves as documentation and reference.
-- ============================================

-- ============================================
-- SECURITY DEFINER FUNCTION
-- ============================================
-- Used to prevent infinite recursion in RLS policies
-- by checking roles without triggering RLS on user_roles table

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.user_roles
    WHERE user_id = _user_id
      AND role = _role
  )
$$;

-- Why: SECURITY DEFINER allows bypassing RLS to check roles
-- without causing infinite recursion when policies reference user_roles.


-- ============================================
-- user_roles TABLE
-- ============================================

-- Users can view their own roles
CREATE POLICY "Users can view their own roles"
  ON public.user_roles FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all roles
CREATE POLICY "Admins can view all roles"
  ON public.user_roles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can manage all roles (INSERT, UPDATE, DELETE)
CREATE POLICY "Admins can manage roles"
  ON public.user_roles FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Users need to see their own permissions.
-- Only admins can modify role assignments to prevent privilege escalation.


-- ============================================
-- profiles TABLE
-- ============================================

-- Users can view their own profile
CREATE POLICY "Users can view their own profile"
  ON public.profiles FOR SELECT
  USING (auth.uid() = id);

-- Admins can view all profiles
CREATE POLICY "Admins can view all profiles"
  ON public.profiles FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can update their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (auth.uid() = id);

-- Why: Users manage their own data. Admins need visibility for user management.
-- Profiles are created automatically via trigger, so no INSERT policy needed.


-- ============================================
-- user_favorites TABLE
-- ============================================

-- Users can view their own favorites
CREATE POLICY "Users can view their own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert their own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete their own favorites"
  ON public.user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- Why: Favorites are personal data. Each user manages only their own list.


-- ============================================
-- user_likes TABLE
-- ============================================

-- Users can view their own likes
CREATE POLICY "Users can view their own likes"
  ON public.user_likes FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own likes
CREATE POLICY "Users can insert their own likes"
  ON public.user_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own likes
CREATE POLICY "Users can delete their own likes"
  ON public.user_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Why: Likes are personal preferences. Users control only their own likes.


-- ============================================
-- watch_history TABLE
-- ============================================

-- Users can view their own watch history
CREATE POLICY "Users can view their own watch history"
  ON public.watch_history FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own watch history
CREATE POLICY "Users can insert their own watch history"
  ON public.watch_history FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own watch history (e.g., update position)
CREATE POLICY "Users can update their own watch history"
  ON public.watch_history FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own watch history
CREATE POLICY "Users can delete their own watch history"
  ON public.watch_history FOR DELETE
  USING (auth.uid() = user_id);

-- Why: Watch history is private viewing data. Users have full control over their history.


-- ============================================
-- server_settings TABLE
-- ============================================

-- Everyone can read server settings
CREATE POLICY "Everyone can read server settings"
  ON public.server_settings FOR SELECT
  USING (true);

-- Only admins can insert server settings
CREATE POLICY "Only admins can insert server settings"
  ON public.server_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update server settings
CREATE POLICY "Only admins can update server settings"
  ON public.server_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Server settings include Jellyfin/Jellyseerr URLs and API keys.
-- Reading is allowed so edge functions can access these settings.
-- API keys are protected by edge function security (never exposed to client).
-- Only admins can modify configuration.


-- ============================================
-- site_settings TABLE
-- ============================================

-- Everyone can read site settings
CREATE POLICY "Everyone can read site settings"
  ON public.site_settings FOR SELECT
  USING (true);

-- Only admins can insert site settings
CREATE POLICY "Only admins can insert site settings"
  ON public.site_settings FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Only admins can update site settings
CREATE POLICY "Only admins can update site settings"
  ON public.site_settings FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Site settings control UI customization (name, logo, etc.).
-- Anyone can read to display correct branding.
-- Only admins can modify site appearance.


-- ============================================
-- news_posts TABLE
-- ============================================

-- Everyone can read published posts
CREATE POLICY "Everyone can read published posts"
  ON public.news_posts FOR SELECT
  USING (published = true);

-- Admins can view all posts (including drafts)
CREATE POLICY "Admins can view all posts"
  ON public.news_posts FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can create posts
CREATE POLICY "Admins can create posts"
  ON public.news_posts FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update posts
CREATE POLICY "Admins can update posts"
  ON public.news_posts FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete posts
CREATE POLICY "Admins can delete posts"
  ON public.news_posts FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Published news is public information.
-- Admins manage news content and can work on drafts before publishing.


-- ============================================
-- jellyseerr_requests TABLE
-- ============================================

-- Users can view their own requests
CREATE POLICY "Users can view their own requests"
  ON public.jellyseerr_requests FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can view all requests
CREATE POLICY "Admins can view all requests"
  ON public.jellyseerr_requests FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Users can create their own requests
CREATE POLICY "Users can create their own requests"
  ON public.jellyseerr_requests FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can update requests (approve/reject)
CREATE POLICY "Admins can update requests"
  ON public.jellyseerr_requests FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete requests
CREATE POLICY "Admins can delete requests"
  ON public.jellyseerr_requests FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Users create content requests and track their status.
-- Admins approve/reject requests and manage the request queue.


-- ============================================
-- user_feedback TABLE
-- ============================================

-- Anyone can view feedback (transparency)
CREATE POLICY "Anyone can view feedback"
  ON public.user_feedback FOR SELECT
  USING (true);

-- Users can create their own feedback
CREATE POLICY "Users can create their own feedback"
  ON public.user_feedback FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own feedback
CREATE POLICY "Users can update their own feedback"
  ON public.user_feedback FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own feedback
CREATE POLICY "Users can delete their own feedback"
  ON public.user_feedback FOR DELETE
  USING (auth.uid() = user_id);

-- Admins can update any feedback (status changes)
CREATE POLICY "Admins can update any feedback"
  ON public.user_feedback FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete any feedback
CREATE POLICY "Admins can delete any feedback"
  ON public.user_feedback FOR DELETE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Feedback is public to encourage transparency and show responsiveness.
-- Users manage their own submissions. Admins can update status and moderate.


-- ============================================
-- update_status TABLE
-- ============================================

-- Admins can view update status
CREATE POLICY "Admins can view update status"
  ON public.update_status FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can insert update status
CREATE POLICY "Admins can insert update status"
  ON public.update_status FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update update status
CREATE POLICY "Admins can update update status"
  ON public.update_status FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Update status is admin-only functionality.
-- Regular users don't need visibility into system update processes.


-- ============================================
-- app_versions TABLE
-- ============================================

-- Everyone can view versions
CREATE POLICY "Everyone can view versions"
  ON public.app_versions FOR SELECT
  USING (true);

-- Admins can manage versions (all operations)
CREATE POLICY "Admins can manage versions"
  ON public.app_versions FOR ALL
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Why: Version information is public for transparency.
-- Only admins can add new versions or mark them as current.


-- ============================================
-- TESTING RLS POLICIES
-- ============================================

-- Test as regular user:
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims.sub = 'user-uuid-here';
-- SELECT * FROM user_favorites;

-- Test as admin:
-- SET LOCAL ROLE authenticated;
-- SET LOCAL request.jwt.claims.sub = 'admin-uuid-here';
-- SELECT * FROM server_settings;

-- Reset:
-- RESET ROLE;


-- ============================================
-- SECURITY BEST PRACTICES
-- ============================================

-- 1. Always use auth.uid() for user-specific data
-- 2. Use has_role() function for admin checks (not direct joins)
-- 3. Test policies with both regular users and admins
-- 4. Never expose service_role_key to client code
-- 5. Use WITH CHECK for INSERT policies
-- 6. Use USING for SELECT, UPDATE, DELETE policies
-- 7. Enable RLS on ALL tables: ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;
-- 8. Review policies regularly for security gaps
-- 9. Log policy violations for security monitoring
-- 10. Use SECURITY DEFINER functions carefully (only when necessary)
