-- Create permission enum for modules
CREATE TYPE public.app_permission AS ENUM (
  'admin_panel',
  'manage_users',
  'manage_settings',
  'manage_news',
  'view_statistics',
  'manage_requests'
);

-- Table for role-based default permissions
CREATE TABLE public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role app_role NOT NULL,
  permission app_permission NOT NULL,
  created_at timestamptz DEFAULT now(),
  UNIQUE(role, permission)
);

-- Table for individual user permission overrides
CREATE TABLE public.user_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  permission app_permission NOT NULL,
  granted boolean NOT NULL DEFAULT true,
  granted_by uuid,
  created_at timestamptz DEFAULT now(),
  UNIQUE(user_id, permission)
);

-- Enable RLS
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for role_permissions (admins manage, all authenticated can read)
CREATE POLICY "Everyone can view role permissions"
ON public.role_permissions FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "Admins can manage role permissions"
ON public.role_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- RLS policies for user_permissions
CREATE POLICY "Users can view their own permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all permissions"
ON public.user_permissions FOR SELECT
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can manage user permissions"
ON public.user_permissions FOR ALL
TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- Insert default admin permissions
INSERT INTO public.role_permissions (role, permission) VALUES
  ('admin', 'admin_panel'),
  ('admin', 'manage_users'),
  ('admin', 'manage_settings'),
  ('admin', 'manage_news'),
  ('admin', 'view_statistics'),
  ('admin', 'manage_requests');

-- Function to check if user has a specific permission
CREATE OR REPLACE FUNCTION public.has_permission(_user_id uuid, _permission app_permission)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    -- First check individual user permission override
    (SELECT granted FROM public.user_permissions 
     WHERE user_id = _user_id AND permission = _permission),
    -- Fall back to role-based permission
    EXISTS (
      SELECT 1 FROM public.user_roles ur
      JOIN public.role_permissions rp ON ur.role = rp.role
      WHERE ur.user_id = _user_id AND rp.permission = _permission
    )
  )
$$;