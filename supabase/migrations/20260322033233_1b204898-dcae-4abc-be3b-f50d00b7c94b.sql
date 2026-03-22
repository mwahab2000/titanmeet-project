
-- Concierge chat sessions for attendees (event-scoped)
CREATE TABLE IF NOT EXISTS public.concierge_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE SET NULL,
  channel text NOT NULL DEFAULT 'web',
  identifier text, -- mobile number or token for identity
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Concierge messages
CREATE TABLE IF NOT EXISTS public.concierge_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.concierge_sessions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_concierge_sessions_event ON public.concierge_sessions(event_id);
CREATE INDEX idx_concierge_sessions_identifier ON public.concierge_sessions(identifier);
CREATE INDEX idx_concierge_messages_session ON public.concierge_messages(session_id);

-- RLS
ALTER TABLE public.concierge_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.concierge_messages ENABLE ROW LEVEL SECURITY;

-- Service role full access
CREATE POLICY "Service role full access concierge_sessions"
  ON public.concierge_sessions FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Service role full access concierge_messages"
  ON public.concierge_messages FOR ALL TO service_role
  USING (true) WITH CHECK (true);

-- Public can select their own sessions (by identifier match - handled in edge function)
-- We keep anon read minimal; the edge function uses service_role
CREATE POLICY "Anon can insert concierge sessions for public events"
  ON public.concierge_sessions FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.events WHERE id = event_id AND status IN ('published', 'ongoing')
  ));

CREATE POLICY "Anon can read own concierge sessions"
  ON public.concierge_sessions FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.events WHERE id = event_id AND status IN ('published', 'ongoing')
  ));

CREATE POLICY "Anon can insert concierge messages"
  ON public.concierge_messages FOR INSERT TO anon
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.concierge_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id AND e.status IN ('published', 'ongoing')
  ));

CREATE POLICY "Anon can read concierge messages"
  ON public.concierge_messages FOR SELECT TO anon
  USING (EXISTS (
    SELECT 1 FROM public.concierge_sessions s
    JOIN public.events e ON e.id = s.event_id
    WHERE s.id = session_id AND e.status IN ('published', 'ongoing')
  ));

-- Event owners can view concierge data
CREATE POLICY "Event owners can view concierge sessions"
  ON public.concierge_sessions FOR SELECT TO authenticated
  USING (owns_event(event_id));

CREATE POLICY "Event owners can view concierge messages"
  ON public.concierge_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.concierge_sessions s
    WHERE s.id = session_id AND owns_event(s.event_id)
  ));

-- Grants
GRANT SELECT, INSERT ON public.concierge_sessions TO anon, authenticated, service_role;
GRANT SELECT, INSERT ON public.concierge_messages TO anon, authenticated, service_role;
GRANT UPDATE ON public.concierge_sessions TO service_role;

-- Updated_at trigger
CREATE TRIGGER set_concierge_sessions_updated_at
  BEFORE UPDATE ON public.concierge_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
