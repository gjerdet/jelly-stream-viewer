-- Drop existing function
DROP FUNCTION IF EXISTS public.setup_server_settings(text, text);

-- Recreate with logic that works even when not logged in
CREATE OR REPLACE FUNCTION public.setup_server_settings(p_server_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  jellyfin_configured BOOLEAN;
  current_user_id UUID;
BEGIN
  -- Get current user ID (may be null if not logged in)
  current_user_id := auth.uid();
  
  -- Check if Jellyfin is already configured
  SELECT EXISTS (
    SELECT 1 FROM server_settings 
    WHERE setting_key = 'jellyfin_server_url' 
    AND setting_value IS NOT NULL 
    AND setting_value != ''
  ) INTO jellyfin_configured;
  
  -- If Jellyfin is not configured, allow anyone to set it up (initial setup)
  -- If Jellyfin is already configured, only admins can reconfigure
  IF jellyfin_configured THEN
    -- Server is configured, check if user is admin
    IF current_user_id IS NULL THEN
      RAISE EXCEPTION 'You must be logged in to update server settings';
    ELSIF NOT public.has_role(current_user_id, 'admin'::app_role) THEN
      RAISE EXCEPTION 'Only administrators can update server settings';
    END IF;
  END IF;
  -- If not configured, allow anyone (no checks needed)

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