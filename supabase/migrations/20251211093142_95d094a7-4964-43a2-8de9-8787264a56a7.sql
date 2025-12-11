-- Create table to track reviewed/approved downloads from Radarr
CREATE TABLE public.radarr_downloads (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  radarr_movie_id INTEGER NOT NULL,
  movie_title TEXT NOT NULL,
  quality TEXT,
  size_bytes BIGINT,
  download_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  reviewed BOOLEAN NOT NULL DEFAULT false,
  reviewed_at TIMESTAMP WITH TIME ZONE,
  reviewed_by UUID REFERENCES auth.users(id),
  notes TEXT,
  needs_transcode BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  UNIQUE(radarr_movie_id, download_date)
);

-- Enable RLS
ALTER TABLE public.radarr_downloads ENABLE ROW LEVEL SECURITY;

-- Everyone can view downloads
CREATE POLICY "Everyone can view radarr downloads"
ON public.radarr_downloads
FOR SELECT
USING (true);

-- Admins can manage downloads
CREATE POLICY "Admins can manage radarr downloads"
ON public.radarr_downloads
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Add trigger for updated_at
CREATE TRIGGER update_radarr_downloads_updated_at
BEFORE UPDATE ON public.radarr_downloads
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();