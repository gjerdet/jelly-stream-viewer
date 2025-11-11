-- Create table for update status tracking
CREATE TABLE IF NOT EXISTS public.update_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  status text NOT NULL DEFAULT 'pending',
  progress integer NOT NULL DEFAULT 0,
  current_step text,
  logs jsonb DEFAULT '[]'::jsonb,
  started_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone,
  error text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.update_status ENABLE ROW LEVEL SECURITY;

-- Allow admins to view all update statuses
CREATE POLICY "Admins can view update status"
  ON public.update_status
  FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to insert update status
CREATE POLICY "Admins can insert update status"
  ON public.update_status
  FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Allow admins to update status
CREATE POLICY "Admins can update update status"
  ON public.update_status
  FOR UPDATE
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for live updates
ALTER TABLE public.update_status REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.update_status;

-- Trigger to update updated_at
CREATE TRIGGER update_update_status_updated_at
  BEFORE UPDATE ON public.update_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();