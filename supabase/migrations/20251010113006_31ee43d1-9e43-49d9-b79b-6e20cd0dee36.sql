-- Remove the public read policy on server_settings to prevent API key exposure
DROP POLICY IF EXISTS "Everyone can read server settings" ON public.server_settings;

-- Server settings should only be accessible to edge functions using service role key
-- No client-side access needed
COMMENT ON TABLE public.server_settings IS 'Contains sensitive API keys - only accessible via service role in edge functions';