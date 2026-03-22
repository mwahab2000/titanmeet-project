-- Communication campaigns table - unified campaign model for both Comm Center and AI Builder
CREATE TABLE IF NOT EXISTS public.communication_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_by uuid NOT NULL,
  campaign_type text NOT NULL DEFAULT 'invitation',
  channels text[] NOT NULL DEFAULT '{email}',
  status text NOT NULL DEFAULT 'draft',
  audience_filter jsonb DEFAULT '{}'::jsonb,
  audience_count integer DEFAULT 0,
  scheduled_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz,
  message_template jsonb DEFAULT '{}'::jsonb,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Campaign recipients - per-attendee delivery tracking
CREATE TABLE IF NOT EXISTS public.campaign_recipients (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id uuid NOT NULL REFERENCES public.communication_campaigns(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  channel text NOT NULL DEFAULT 'email',
  delivery_status text NOT NULL DEFAULT 'queued',
  provider_message_id text,
  error text,
  sent_at timestamptz,
  delivered_at timestamptz,
  opened_at timestamptz,
  created_at timestamptz DEFAULT now(),
  UNIQUE(campaign_id, attendee_id, channel)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_campaigns_event ON public.communication_campaigns(event_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_status ON public.communication_campaigns(status);
CREATE INDEX IF NOT EXISTS idx_campaigns_type ON public.communication_campaigns(campaign_type);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_campaign ON public.campaign_recipients(campaign_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_attendee ON public.campaign_recipients(attendee_id);
CREATE INDEX IF NOT EXISTS idx_campaign_recipients_status ON public.campaign_recipients(delivery_status);

-- RLS
ALTER TABLE public.communication_campaigns ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.campaign_recipients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Event owners can manage campaigns"
  ON public.communication_campaigns FOR ALL
  TO authenticated
  USING (owns_event(event_id))
  WITH CHECK (owns_event(event_id));

CREATE POLICY "Service role full access campaigns"
  ON public.communication_campaigns FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Event owners can manage campaign recipients"
  ON public.campaign_recipients FOR ALL
  TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.communication_campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND owns_event(c.event_id)
  ))
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.communication_campaigns c
    WHERE c.id = campaign_recipients.campaign_id
    AND owns_event(c.event_id)
  ));

CREATE POLICY "Service role full access campaign recipients"
  ON public.campaign_recipients FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER set_campaigns_updated_at
  BEFORE UPDATE ON public.communication_campaigns
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();