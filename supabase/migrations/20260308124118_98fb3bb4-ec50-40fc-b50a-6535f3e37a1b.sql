
-- Add WhatsApp tracking columns to survey_invites
ALTER TABLE public.survey_invites
  ADD COLUMN IF NOT EXISTS sent_via_whatsapp boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS sent_via_email boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS whatsapp_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS email_sent_at timestamptz NULL,
  ADD COLUMN IF NOT EXISTS last_sent_at timestamptz NULL;

-- Create message_logs table for tracking all delivery channels
CREATE TABLE IF NOT EXISTS public.message_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  survey_id uuid NULL REFERENCES public.surveys(id) ON DELETE SET NULL,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  channel text NOT NULL,
  to_address text NOT NULL,
  subject text NULL,
  message_body text NOT NULL,
  provider text NOT NULL,
  provider_message_id text NULL,
  status text NOT NULL DEFAULT 'queued',
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for message_logs
ALTER TABLE public.message_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can manage message_logs"
  ON public.message_logs FOR ALL
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

-- Grant permissions
GRANT SELECT, INSERT, UPDATE ON public.message_logs TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.message_logs TO service_role;

-- Grant new columns on survey_invites to service_role (already has access but ensure)
GRANT SELECT, INSERT, UPDATE ON public.survey_invites TO service_role;
