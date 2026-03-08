
-- ============================================================
-- PayPal Migration: Adapt existing tables + add entitlements
-- ============================================================

-- 1) Add purchase_type and provider_subscription_id to payment_intents
ALTER TABLE public.payment_intents
  ADD COLUMN IF NOT EXISTS purchase_type text NOT NULL DEFAULT 'one_time_30d',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

-- Update existing rows to paypal default (they were triple_a but we keep data)
-- No destructive changes to existing data

-- 2) Add cancel_at_period_end to account_subscriptions
ALTER TABLE public.account_subscriptions
  ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS provider text NOT NULL DEFAULT 'paypal',
  ADD COLUMN IF NOT EXISTS provider_subscription_id text;

-- Create unique index on provider_subscription_id (nullable, so partial)
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_subscriptions_provider_sub_id
  ON public.account_subscriptions(provider_subscription_id)
  WHERE provider_subscription_id IS NOT NULL;

-- 3) Create account_entitlements table
CREATE TABLE IF NOT EXISTS public.account_entitlements (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_until timestamptz NOT NULL DEFAULT now(),
  source text NOT NULL DEFAULT 'none',
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.account_entitlements ENABLE ROW LEVEL SECURITY;

-- RLS: users can view own entitlement
CREATE POLICY "Users can view own entitlement"
  ON public.account_entitlements FOR SELECT
  USING (auth.uid() = user_id);

-- RLS: admins can view all entitlements
CREATE POLICY "Admins can view all entitlements"
  ON public.account_entitlements FOR SELECT
  USING (public.is_admin() OR public.is_owner());

-- No direct client insert/update - only service role via edge functions

-- 4) Grant permissions
GRANT SELECT ON public.account_entitlements TO authenticated, anon;

-- 5) Update payment_events: rename raw_payload to payload if needed (keep backward compat)
-- Actually raw_payload already exists, we'll just use it as-is

-- 6) Trigger for updated_at on account_entitlements
CREATE TRIGGER set_account_entitlements_updated_at
  BEFORE UPDATE ON public.account_entitlements
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
