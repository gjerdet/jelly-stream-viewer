-- Create enum for report categories
CREATE TYPE public.media_report_category AS ENUM (
  'buffering',
  'no_audio',
  'no_video',
  'subtitle_issues',
  'wrong_file',
  'quality_issues',
  'other'
);

-- Create enum for compatibility status
CREATE TYPE public.compatibility_status AS ENUM (
  'compatible',
  'needs_transcode',
  'unknown',
  'error'
);

-- Table for storing media compatibility scan results
CREATE TABLE public.media_compatibility (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jellyfin_item_id TEXT NOT NULL UNIQUE,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  jellyfin_series_id TEXT,
  jellyfin_season_id TEXT,
  image_url TEXT,
  video_codec TEXT,
  audio_codec TEXT,
  container TEXT,
  status compatibility_status NOT NULL DEFAULT 'unknown',
  transcode_reason TEXT,
  resolved BOOLEAN NOT NULL DEFAULT false,
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  last_scanned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for user-reported media issues
CREATE TABLE public.media_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  image_url TEXT,
  category media_report_category NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Table for scan schedule settings
CREATE TABLE public.scan_schedule (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  enabled BOOLEAN NOT NULL DEFAULT false,
  cron_expression TEXT NOT NULL DEFAULT '0 3 * * *',
  last_run_at TIMESTAMP WITH TIME ZONE,
  next_run_at TIMESTAMP WITH TIME ZONE,
  last_run_status TEXT,
  last_run_items_scanned INTEGER DEFAULT 0,
  last_run_issues_found INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.media_compatibility ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.media_reports ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scan_schedule ENABLE ROW LEVEL SECURITY;

-- RLS policies for media_compatibility (admin only for write, all can read)
CREATE POLICY "Everyone can view compatibility status"
ON public.media_compatibility
FOR SELECT
USING (true);

CREATE POLICY "Admins can manage compatibility"
ON public.media_compatibility
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for media_reports
CREATE POLICY "Users can create their own reports"
ON public.media_reports
FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view their own reports"
ON public.media_reports
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Admins can view all reports"
ON public.media_reports
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can update reports"
ON public.media_reports
FOR UPDATE
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Admins can delete reports"
ON public.media_reports
FOR DELETE
USING (has_role(auth.uid(), 'admin'::app_role));

-- RLS policies for scan_schedule (admin only)
CREATE POLICY "Admins can manage scan schedule"
ON public.scan_schedule
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create indexes for better performance
CREATE INDEX idx_media_compatibility_status ON public.media_compatibility(status);
CREATE INDEX idx_media_compatibility_resolved ON public.media_compatibility(resolved);
CREATE INDEX idx_media_reports_user_id ON public.media_reports(user_id);
CREATE INDEX idx_media_reports_status ON public.media_reports(status);

-- Add trigger for updated_at
CREATE TRIGGER update_media_compatibility_updated_at
BEFORE UPDATE ON public.media_compatibility
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_media_reports_updated_at
BEFORE UPDATE ON public.media_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_scan_schedule_updated_at
BEFORE UPDATE ON public.scan_schedule
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Insert default scan schedule row
INSERT INTO public.scan_schedule (enabled, cron_expression)
VALUES (false, '0 3 * * *');