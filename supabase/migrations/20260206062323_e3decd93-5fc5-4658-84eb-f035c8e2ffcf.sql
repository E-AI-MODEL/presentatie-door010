-- Create table for cached scraped events
CREATE TABLE public.scraped_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  source_url TEXT NOT NULL,
  source_name TEXT NOT NULL,
  events_data JSONB NOT NULL DEFAULT '[]'::jsonb,
  scraped_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '24 hours'),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create unique constraint on source_url for upsert
CREATE UNIQUE INDEX idx_scraped_events_source_url ON public.scraped_events(source_url);

-- Enable Row Level Security
ALTER TABLE public.scraped_events ENABLE ROW LEVEL SECURITY;

-- Allow public read access (events are public information)
CREATE POLICY "Anyone can view scraped events"
ON public.scraped_events
FOR SELECT
USING (true);

-- Only allow inserts/updates via edge function (service role)
-- No INSERT/UPDATE/DELETE policies for regular users

-- Trigger for updating timestamps
CREATE TRIGGER update_scraped_events_updated_at
BEFORE UPDATE ON public.scraped_events
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();