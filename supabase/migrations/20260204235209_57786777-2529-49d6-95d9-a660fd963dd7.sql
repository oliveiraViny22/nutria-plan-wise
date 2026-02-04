-- Create table for tracking conversion funnel events
CREATE TABLE public.conversion_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  event_type TEXT NOT NULL,
  feature_key TEXT NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.conversion_events ENABLE ROW LEVEL SECURITY;

-- Users can insert their own events
CREATE POLICY "Users can insert own conversion events"
ON public.conversion_events
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Users can read their own events (for potential future dashboard)
CREATE POLICY "Users can read own conversion events"
ON public.conversion_events
FOR SELECT
USING (auth.uid() = user_id);

-- Admins can read all events for analytics
CREATE POLICY "Admins can read all conversion events"
ON public.conversion_events
FOR SELECT
USING (public.has_role(auth.uid(), 'admin'));

-- Create index for efficient querying
CREATE INDEX idx_conversion_events_feature ON public.conversion_events(feature_key, created_at DESC);
CREATE INDEX idx_conversion_events_user ON public.conversion_events(user_id, created_at DESC);