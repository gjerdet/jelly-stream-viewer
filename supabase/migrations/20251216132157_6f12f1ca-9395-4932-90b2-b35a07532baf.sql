-- Add public read policy for server_settings
-- This allows anyone (including unauthenticated users) to read server settings
-- which is needed for the app to load Jellyfin URLs etc.

CREATE POLICY "Everyone can read server settings"
  ON public.server_settings FOR SELECT
  USING (true);