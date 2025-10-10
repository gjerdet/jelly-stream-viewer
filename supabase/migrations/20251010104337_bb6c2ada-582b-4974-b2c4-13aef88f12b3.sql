-- Create site_settings table for customizable site information
CREATE TABLE IF NOT EXISTS public.site_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Enable RLS
ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- Everyone can read settings
CREATE POLICY "Everyone can read site settings"
ON public.site_settings
FOR SELECT
USING (true);

-- Only admins can update settings
CREATE POLICY "Only admins can update site settings"
ON public.site_settings
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Only admins can insert settings
CREATE POLICY "Only admins can insert site settings"
ON public.site_settings
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Insert default values
INSERT INTO public.site_settings (setting_key, setting_value) VALUES
  ('site_name', 'Jelly Stream Viewer'),
  ('site_logo_url', ''),
  ('site_header_title', 'Jelly Stream Viewer')
ON CONFLICT (setting_key) DO NOTHING;

-- Create news_posts table for info page
CREATE TABLE IF NOT EXISTS public.news_posts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  published BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  created_by UUID REFERENCES auth.users(id) NOT NULL
);

-- Enable RLS
ALTER TABLE public.news_posts ENABLE ROW LEVEL SECURITY;

-- Everyone can read published posts
CREATE POLICY "Everyone can read published posts"
ON public.news_posts
FOR SELECT
USING (published = true);

-- Admins can view all posts
CREATE POLICY "Admins can view all posts"
ON public.news_posts
FOR SELECT
USING (has_role(auth.uid(), 'admin'));

-- Admins can create posts
CREATE POLICY "Admins can create posts"
ON public.news_posts
FOR INSERT
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Admins can update posts
CREATE POLICY "Admins can update posts"
ON public.news_posts
FOR UPDATE
USING (has_role(auth.uid(), 'admin'));

-- Admins can delete posts
CREATE POLICY "Admins can delete posts"
ON public.news_posts
FOR DELETE
USING (has_role(auth.uid(), 'admin'));

-- Trigger for updating timestamps
CREATE TRIGGER update_news_posts_updated_at
BEFORE UPDATE ON public.news_posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();