
-- Dress codes table: per-day dress code entries for an event
CREATE TABLE public.dress_codes (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  day_number INTEGER NOT NULL DEFAULT 1,
  dress_type TEXT NOT NULL DEFAULT 'business_casual',
  custom_instructions TEXT,
  reference_images JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(event_id, day_number)
);

-- RLS
ALTER TABLE public.dress_codes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view dress codes for their events"
  ON public.dress_codes FOR SELECT
  USING (public.owns_event(event_id));

CREATE POLICY "Users can insert dress codes for their events"
  ON public.dress_codes FOR INSERT
  WITH CHECK (public.owns_event(event_id));

CREATE POLICY "Users can update dress codes for their events"
  ON public.dress_codes FOR UPDATE
  USING (public.owns_event(event_id));

CREATE POLICY "Users can delete dress codes for their events"
  ON public.dress_codes FOR DELETE
  USING (public.owns_event(event_id));

-- Public read for published events
CREATE POLICY "Public can view dress codes of published events"
  ON public.dress_codes FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.status IN ('published', 'ongoing')
  ));

-- Storage bucket for dress code reference images
INSERT INTO storage.buckets (id, name, public) VALUES ('dress-code-images', 'dress-code-images', true)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Anyone can view dress code images"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'dress-code-images');

CREATE POLICY "Authenticated users can upload dress code images"
  ON storage.objects FOR INSERT
  WITH CHECK (bucket_id = 'dress-code-images' AND auth.role() = 'authenticated');

CREATE POLICY "Authenticated users can delete dress code images"
  ON storage.objects FOR DELETE
  USING (bucket_id = 'dress-code-images' AND auth.role() = 'authenticated');
