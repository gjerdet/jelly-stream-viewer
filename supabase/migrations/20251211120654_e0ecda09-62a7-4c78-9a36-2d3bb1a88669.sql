-- Drop all existing SELECT policies on server_settings
DROP POLICY IF EXISTS "Allow read access to server_settings" ON public.server_settings;
DROP POLICY IF EXISTS "Only admins can read server settings" ON public.server_settings;

-- Create a proper PERMISSIVE SELECT policy that allows everyone to read
CREATE POLICY "Allow public read access to server_settings"
ON public.server_settings
FOR SELECT
TO public
USING (true);