
-- Create event_rooms table for venue rooms
CREATE TABLE public.event_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  days jsonb NOT NULL DEFAULT '[]'::jsonb,
  capacity integer,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Add room_id column to agenda_items
ALTER TABLE public.agenda_items ADD COLUMN room_id uuid REFERENCES public.event_rooms(id) ON DELETE SET NULL;

-- RLS
ALTER TABLE public.event_rooms ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can manage event_rooms"
  ON public.event_rooms FOR ALL
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

CREATE POLICY "Public can view event_rooms of published events"
  ON public.event_rooms FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_rooms TO authenticated;
GRANT SELECT ON public.event_rooms TO anon;
