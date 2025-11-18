-- Drop existing function
DROP FUNCTION IF EXISTS public.setup_server_settings(text, text);

-- Recreate with better logic for initial setup
CREATE OR REPLACE FUNCTION public.setup_server_settings(p_server_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Allow setup if:
  -- 1. No Jellyfin server URL is configured yet (initial setup), OR
  -- 2. User is an admin (reconfiguration)
  
  DECLARE
    jellyfin_configured BOOLEAN;
  BEGIN
    -- Check if Jellyfin is already configured
    SELECT EXISTS (
      SELECT 1 FROM server_settings 
      WHERE setting_key = 'jellyfin_server_url' 
      AND setting_value IS NOT NULL 
      AND setting_value != ''
    ) INTO jellyfin_configured;
    
    -- If Jellyfin is not configured, allow anyone to set it up (initial setup)
    IF NOT jellyfin_configured THEN
      NULL; -- Allow setup
    -- If Jellyfin is already configured, only admins can reconfigure
    ELSIF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can update server settings';
    END IF;
  END;

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