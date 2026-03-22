
-- 1. Add check-in tracking to attendees
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS checked_in_at timestamptz DEFAULT NULL;
ALTER TABLE public.attendees ADD COLUMN IF NOT EXISTS checked_in_via text DEFAULT NULL;

-- 2. Scheduled messages queue
CREATE TABLE IF NOT EXISTS public.scheduled_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'whatsapp',
  message_type text NOT NULL DEFAULT 'reminder',
  scheduled_at timestamptz NOT NULL,
  sent_at timestamptz DEFAULT NULL,
  cancelled_at timestamptz DEFAULT NULL,
  status text NOT NULL DEFAULT 'pending',
  payload jsonb NOT NULL DEFAULT '{}',
  error text DEFAULT NULL,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_scheduled_messages_pending ON public.scheduled_messages (scheduled_at) WHERE status = 'pending';
CREATE INDEX idx_scheduled_messages_event ON public.scheduled_messages (event_id);

ALTER TABLE public.scheduled_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can manage scheduled messages"
  ON public.scheduled_messages FOR ALL
  TO authenticated
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

CREATE POLICY "Service role full access scheduled messages"
  ON public.scheduled_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.scheduled_messages TO service_role;

CREATE TRIGGER set_scheduled_messages_updated_at
  BEFORE UPDATE ON public.scheduled_messages
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
