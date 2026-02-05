-- Force PostgREST to reload the schema cache to apply the new RLS policy
NOTIFY pgrst, 'reload schema';