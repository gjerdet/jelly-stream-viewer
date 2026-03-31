
-- Remove sensitive admin-only tables from Realtime publication
ALTER PUBLICATION supabase_realtime DROP TABLE public.transcode_jobs;
ALTER PUBLICATION supabase_realtime DROP TABLE public.update_status;
