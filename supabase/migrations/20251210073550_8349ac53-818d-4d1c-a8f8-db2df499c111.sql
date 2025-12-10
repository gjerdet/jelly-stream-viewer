-- Create function to update the cron job when schedule changes
CREATE OR REPLACE FUNCTION public.update_scan_cron_job()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'cron'
AS $function$
DECLARE
  job_exists boolean;
BEGIN
  -- Check if job exists
  SELECT EXISTS (
    SELECT 1 FROM cron.job WHERE jobname = 'media-compatibility-scan'
  ) INTO job_exists;

  IF NEW.enabled THEN
    IF job_exists THEN
      -- Update existing job
      PERFORM cron.unschedule('media-compatibility-scan');
    END IF;
    
    -- Schedule new job with updated cron expression
    PERFORM cron.schedule(
      'media-compatibility-scan',
      NEW.cron_expression,
      format(
        'SELECT net.http_post(
          url:=''https://ypjihlfhxqyrpfjfmjdm.supabase.co/functions/v1/scan-media-compatibility'',
          headers:=''{"Content-Type": "application/json", "Authorization": "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlwamlobGZoeHF5cnBmamZtamRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk5NTcxMzYsImV4cCI6MjA3NTUzMzEzNn0.7ksUs-C2G6lSWrJgI-EK96AZPyEDASkNDY7IVx0nZz4"}''::jsonb,
          body:=''{}''::jsonb
        ) as request_id;'
      )
    );
  ELSE
    -- Disable: unschedule if exists
    IF job_exists THEN
      PERFORM cron.unschedule('media-compatibility-scan');
    END IF;
  END IF;

  RETURN NEW;
END;
$function$;

-- Create trigger to auto-sync cron job when scan_schedule is updated
DROP TRIGGER IF EXISTS sync_scan_cron_job ON public.scan_schedule;
CREATE TRIGGER sync_scan_cron_job
  AFTER UPDATE ON public.scan_schedule
  FOR EACH ROW
  WHEN (OLD.enabled IS DISTINCT FROM NEW.enabled OR OLD.cron_expression IS DISTINCT FROM NEW.cron_expression)
  EXECUTE FUNCTION public.update_scan_cron_job();