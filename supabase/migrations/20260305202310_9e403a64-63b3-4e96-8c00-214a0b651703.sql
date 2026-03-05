
-- survey_invites: one per attendee per survey, with unguessable token
CREATE TABLE public.survey_invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  survey_id uuid NOT NULL REFERENCES public.surveys(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  token text NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  sent_at timestamptz,
  opened_at timestamptz,
  submitted_at timestamptz,
  status text NOT NULL DEFAULT 'created',
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(survey_id, attendee_id)
);

ALTER TABLE public.survey_invites ENABLE ROW LEVEL SECURITY;

-- Only event owners can read invites
CREATE POLICY "Event owners can manage survey_invites"
  ON public.survey_invites FOR ALL
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

-- Grant access
GRANT ALL ON public.survey_invites TO authenticated;
GRANT SELECT ON public.survey_invites TO anon;

-- Index for token lookups
CREATE INDEX idx_survey_invites_token ON public.survey_invites(token);
CREATE INDEX idx_survey_invites_survey ON public.survey_invites(survey_id);
