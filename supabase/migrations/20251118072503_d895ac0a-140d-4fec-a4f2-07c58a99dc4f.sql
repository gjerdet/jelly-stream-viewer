-- Fix critical security issue: Restrict server_settings read access to admins only
-- This prevents regular users from reading API keys and secrets

DROP POLICY IF EXISTS "Everyone can read server settings" ON public.server_settings;

CREATE POLICY "Only admins can read server settings"
  ON public.server_settings 
  FOR SELECT 
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Site settings can remain public as they contain only display settings (site name, logo URLs)
-- No changes needed to site_settings table