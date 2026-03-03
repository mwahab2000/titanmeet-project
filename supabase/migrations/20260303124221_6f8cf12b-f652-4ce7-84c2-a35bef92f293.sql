-- Payment intents table
CREATE TABLE public.payment_intents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  subscription_id uuid REFERENCES public.account_subscriptions(id) ON DELETE SET NULL,
  plan_id text NOT NULL REFERENCES public.subscription_plans(id),
  provider text NOT NULL DEFAULT 'triple_a',
  internal_order_id text NOT NULL UNIQUE DEFAULT ('TM-' || substr(gen_random_uuid()::text, 1, 8)),
  provider_payment_id text,
  amount_usd_cents integer NOT NULL,
  currency text NOT NULL DEFAULT 'USD',
  status text NOT NULL DEFAULT 'pending',
  checkout_url text,
  expires_at timestamptz,
  paid_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

ALTER TABLE public.payment_intents ENABLE ROW LEVEL SECURITY;

-- Users can view their own payment intents
CREATE POLICY "Users can view own payment intents"
  ON public.payment_intents FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own payment intents
CREATE POLICY "Users can insert own payment intents"
  ON public.payment_intents FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Admins can view all payment intents
CREATE POLICY "Admins can view all payment intents"
  ON public.payment_intents FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Service role updates (from webhooks) - no user-facing UPDATE policy needed
-- Webhook uses service role key

-- Payment events table (webhook/status history)
CREATE TABLE public.payment_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payment_intent_id uuid NOT NULL REFERENCES public.payment_intents(id) ON DELETE CASCADE,
  provider text NOT NULL DEFAULT 'triple_a',
  event_type text NOT NULL,
  raw_payload jsonb,
  processed_at timestamptz DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.payment_events ENABLE ROW LEVEL SECURITY;

-- Users can view events for their own payment intents
CREATE POLICY "Users can view own payment events"
  ON public.payment_events FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM public.payment_intents pi
    WHERE pi.id = payment_events.payment_intent_id AND pi.user_id = auth.uid()
  ));

-- Admins can view all payment events
CREATE POLICY "Admins can view all payment events"
  ON public.payment_events FOR SELECT
  USING (has_role(auth.uid(), 'admin'::app_role));

-- Updated_at trigger for payment_intents
CREATE TRIGGER set_payment_intents_updated_at
  BEFORE UPDATE ON public.payment_intents
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();