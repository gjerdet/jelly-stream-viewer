-- Fix critical security issue: Add authentication checks to setup_server_settings
-- Allow initial setup (no admins exist) OR require admin role for all subsequent calls

CREATE OR REPLACE FUNCTION public.setup_server_settings(p_server_url text, p_api_key text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
BEGIN
  -- Check if this is initial setup (no admins exist) or if caller is admin
  IF NOT EXISTS (SELECT 1 FROM public.user_roles WHERE role = 'admin') THEN
    -- Initial setup: no admins exist yet, allow configuration
    NULL;
  ELSIF NOT public.has_role(auth.uid(), 'admin'::app_role) THEN
    -- Not initial setup and caller is not admin
    RAISE EXCEPTION 'Only administrators can update server settings';
  END IF;

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