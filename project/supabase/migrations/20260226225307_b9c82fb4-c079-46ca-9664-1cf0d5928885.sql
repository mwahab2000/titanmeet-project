
-- Create speakers table
CREATE TABLE public.speakers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  title text,
  bio text,
  photo_url text
);
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can view speakers" ON public.speakers FOR SELECT USING (true);
CREATE POLICY "Event owners can manage speakers" ON public.speakers FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Add columns to agenda_items
ALTER TABLE public.agenda_items ADD COLUMN day_number integer DEFAULT 1;
ALTER TABLE public.agenda_items ADD COLUMN speaker_id uuid REFERENCES public.speakers(id) ON DELETE SET NULL;
