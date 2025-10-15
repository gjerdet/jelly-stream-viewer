-- Create version management table
CREATE TABLE IF NOT EXISTS public.app_versions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  version_number text NOT NULL UNIQUE,
  release_date timestamp with time zone NOT NULL DEFAULT now(),
  description text,
  changelog text,
  is_current boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;

-- Admins can manage versions
CREATE POLICY "Admins can manage versions"
ON public.app_versions
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Everyone can view versions
CREATE POLICY "Everyone can view versions"
ON public.app_versions
FOR SELECT
USING (true);

-- Insert current version
INSERT INTO public.app_versions (version_number, description, changelog, is_current)
VALUES ('1.0.0', 'Initial release', 'First stable version of Jelly Stream Viewer', true);