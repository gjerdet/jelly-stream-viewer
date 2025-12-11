-- Allow anonymous users to read server_settings
DROP POLICY IF EXISTS "Allow read access to server_settings" ON public.server_settings;
CREATE POLICY "Allow read access to server_settings"
ON public.server_settings
FOR SELECT
USING (true);