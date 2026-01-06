-- Create table for user-reported duplicates
CREATE TABLE public.duplicate_reports (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  jellyfin_item_id TEXT NOT NULL,
  jellyfin_item_name TEXT NOT NULL,
  jellyfin_item_type TEXT NOT NULL,
  jellyfin_series_name TEXT,
  image_url TEXT,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  resolved_at TIMESTAMP WITH TIME ZONE,
  resolved_by UUID,
  admin_notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE public.duplicate_reports ENABLE ROW LEVEL SECURITY;

-- Users can create their own duplicate reports
CREATE POLICY "Users can create their own duplicate reports" 
ON public.duplicate_reports 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

-- Users can view their own duplicate reports
CREATE POLICY "Users can view their own duplicate reports" 
ON public.duplicate_reports 
FOR SELECT 
USING (auth.uid() = user_id);

-- Admins can view all duplicate reports
CREATE POLICY "Admins can view all duplicate reports" 
ON public.duplicate_reports 
FOR SELECT 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can update duplicate reports
CREATE POLICY "Admins can update duplicate reports" 
ON public.duplicate_reports 
FOR UPDATE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Admins can delete duplicate reports
CREATE POLICY "Admins can delete duplicate reports" 
ON public.duplicate_reports 
FOR DELETE 
USING (has_role(auth.uid(), 'admin'::app_role));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_duplicate_reports_updated_at
BEFORE UPDATE ON public.duplicate_reports
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();