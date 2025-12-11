-- Drop existing public read policy for server_settings
DROP POLICY IF EXISTS "Allow public read access to server_settings" ON public.server_settings;

-- Create new policy: Only admins can read server_settings
CREATE POLICY "Admins can view server_settings"
ON public.server_settings
FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Ensure the existing admin insert/update policies are in place
DROP POLICY IF EXISTS "Admins can insert server_settings" ON public.server_settings;
DROP POLICY IF EXISTS "Admins can update server_settings" ON public.server_settings;

CREATE POLICY "Admins can insert server_settings"
ON public.server_settings
FOR INSERT
TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update server_settings"
ON public.server_settings
FOR UPDATE
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));