-- Allow everyone to read server settings (Jellyfin URL and API key)
-- This is needed so all users can connect to Jellyfin
CREATE POLICY "Everyone can read server settings"
ON server_settings
FOR SELECT
USING (true);

-- Create a public function that allows unauthenticated setup
-- This bypasses RLS for initial setup only
CREATE OR REPLACE FUNCTION public.setup_server_settings(
  p_server_url TEXT,
  p_api_key TEXT
)
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