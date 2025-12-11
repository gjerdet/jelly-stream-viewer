-- Remove conflicting admin-only read policy
DROP POLICY IF EXISTS "Only admins can read server settings" ON public.server_settings;