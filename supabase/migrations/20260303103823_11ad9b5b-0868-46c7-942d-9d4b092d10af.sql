-- Remove duplicate RLS policies on server_settings (keep only one of each type)
DROP POLICY IF EXISTS "Authenticated users can read server settings" ON public.server_settings;
DROP POLICY IF EXISTS "Only admins can insert server settings" ON public.server_settings;
DROP POLICY IF EXISTS "Only admins can update server settings" ON public.server_settings;