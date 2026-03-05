
-- Create event_announcements table
CREATE TABLE public.event_announcements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  message text NOT NULL,
  type text NOT NULL DEFAULT 'info',
  target text NOT NULL DEFAULT 'public',
  priority integer NOT NULL DEFAULT 0,
  is_pinned boolean NOT NULL DEFAULT false,
  start_at timestamptz NULL,
  end_at timestamptz NULL,
  link_url text NULL,
  link_label text NULL,
  created_by uuid NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_announcements_event_id ON public.event_announcements(event_id);
CREATE INDEX idx_event_announcements_active ON public.event_announcements(event_id, target, is_pinned DESC, priority DESC);

-- Updated_at trigger
CREATE TRIGGER set_event_announcements_updated_at
  BEFORE UPDATE ON public.event_announcements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.event_announcements ENABLE ROW LEVEL SECURITY;

-- Policy: public can read public+active announcements of published events
CREATE POLICY "Public can view active public announcements"
  ON public.event_announcements FOR SELECT
  USING (
    (
      target = 'public'
      AND (start_at IS NULL OR now() >= start_at)
      AND (end_at IS NULL OR now() <= end_at)
      AND is_event_public(event_id)
    )
    OR owns_event(event_id)
  );

-- Policy: event owners can manage all announcements
CREATE POLICY "Event owners can manage event_announcements"
  ON public.event_announcements FOR ALL
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_announcements TO authenticated;
GRANT SELECT ON public.event_announcements TO anon;
