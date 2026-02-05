-- Fix: The "Everyone can read server settings" policy only applies to 'public' role (anonymous)
-- Authenticated users who are not admins cannot read server settings
-- We need to allow ALL authenticated users to read server settings

-- Create a new policy for authenticated users to read server settings
CREATE POLICY "Authenticated users can read server settings"
  ON public.server_settings FOR SELECT
  TO authenticated
  USING (true);