
-- Create inbound_messages table
CREATE TABLE public.inbound_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider text NOT NULL DEFAULT 'twilio',
  channel text NOT NULL DEFAULT 'whatsapp',
  provider_message_id text,
  from_phone text NOT NULL,
  to_phone text NOT NULL,
  body text NOT NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  resolved_status text NOT NULL DEFAULT 'unknown',
  resolution_reason text,
  raw_payload jsonb
);

-- RLS
ALTER TABLE public.inbound_messages ENABLE ROW LEVEL SECURITY;

-- Event owners can view inbound messages for their events
CREATE POLICY "Event owners can view inbound messages"
  ON public.inbound_messages
  FOR SELECT
  TO authenticated
  USING (
    owns_event(event_id)
    OR is_admin()
    OR is_owner()
  );

-- Event owners can update (for manual routing)
CREATE POLICY "Event owners can update inbound messages"
  ON public.inbound_messages
  FOR UPDATE
  TO authenticated
  USING (
    owns_event(event_id)
    OR event_id IS NULL  -- unassigned messages editable by any authenticated user for routing
    OR is_admin()
    OR is_owner()
  );

-- Service role can insert (edge function)
CREATE POLICY "Service role can insert inbound messages"
  ON public.inbound_messages
  FOR INSERT
  TO service_role
  WITH CHECK (true);

-- Service role can select (edge function resolution queries)
CREATE POLICY "Service role can select inbound messages"
  ON public.inbound_messages
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Admins/owners can view unassigned messages
CREATE POLICY "Admins can view unassigned inbound messages"
  ON public.inbound_messages
  FOR SELECT
  TO authenticated
  USING (
    event_id IS NULL AND (is_admin() OR is_owner())
  );

-- Grant permissions
GRANT SELECT, UPDATE ON public.inbound_messages TO authenticated;
GRANT ALL ON public.inbound_messages TO service_role;

-- Index for phone lookup
CREATE INDEX idx_inbound_messages_from_phone ON public.inbound_messages(from_phone);
CREATE INDEX idx_inbound_messages_event_id ON public.inbound_messages(event_id);
CREATE INDEX idx_inbound_messages_received_at ON public.inbound_messages(received_at DESC);
