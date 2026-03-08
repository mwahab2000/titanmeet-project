
-- Create event_invites table
CREATE TABLE public.event_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL DEFAULT encode(extensions.gen_random_bytes(32), 'hex'),
  status text NOT NULL DEFAULT 'created',
  sent_via_whatsapp boolean NOT NULL DEFAULT false,
  sent_via_email boolean NOT NULL DEFAULT false,
  whatsapp_sent_at timestamptz,
  email_sent_at timestamptz,
  last_sent_at timestamptz,
  opened_at timestamptz,
  rsvp_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, attendee_id)
);

-- Enable RLS
ALTER TABLE public.event_invites ENABLE ROW LEVEL SECURITY;

-- RLS: event owners can manage
CREATE POLICY "Event owners can manage event_invites"
  ON public.event_invites FOR ALL
  TO authenticated
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

-- Grant access
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.event_invites TO service_role;
