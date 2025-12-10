-- Add scan_status column to track running scans
ALTER TABLE public.scan_schedule 
ADD COLUMN IF NOT EXISTS scan_status text NOT NULL DEFAULT 'idle';

-- Add comment for documentation
COMMENT ON COLUMN public.scan_schedule.scan_status IS 'Current status: idle, running, completed, error';