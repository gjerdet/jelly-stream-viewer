-- Create transcode jobs table
CREATE TABLE public.transcode_jobs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  file_path TEXT,
  output_format TEXT NOT NULL DEFAULT 'hevc',
  status TEXT NOT NULL DEFAULT 'pending',
  progress INTEGER NOT NULL DEFAULT 0,
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  error TEXT,
  logs JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  created_by UUID
);

-- Enable RLS
ALTER TABLE public.transcode_jobs ENABLE ROW LEVEL SECURITY;

-- RLS policies
CREATE POLICY "Admins can manage transcode jobs"
ON public.transcode_jobs
FOR ALL
USING (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Everyone can view transcode jobs"
ON public.transcode_jobs
FOR SELECT
USING (true);

-- Trigger for updated_at
CREATE TRIGGER update_transcode_jobs_updated_at
BEFORE UPDATE ON public.transcode_jobs
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();