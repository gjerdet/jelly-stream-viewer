-- Add pinned column to news_posts
ALTER TABLE public.news_posts 
ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT false;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_news_posts_pinned_created 
ON public.news_posts (pinned DESC, created_at DESC);