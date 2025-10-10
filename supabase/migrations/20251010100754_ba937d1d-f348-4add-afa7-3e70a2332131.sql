-- Add unique constraint on watch_history to allow upsert operations
ALTER TABLE public.watch_history 
ADD CONSTRAINT watch_history_user_item_unique 
UNIQUE (user_id, jellyfin_item_id);