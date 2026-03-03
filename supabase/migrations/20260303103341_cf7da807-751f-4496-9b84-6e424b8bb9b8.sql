
-- Subscription plans (static reference table)
CREATE TABLE public.subscription_plans (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  monthly_price_cents INTEGER NOT NULL,
  max_clients INTEGER NOT NULL,
  max_active_events INTEGER NOT NULL,
  max_attendees INTEGER NOT NULL,
  max_emails INTEGER NOT NULL,
  max_storage_gb INTEGER NOT NULL,
  support_tier TEXT NOT NULL DEFAULT 'standard',
  overage_client_cents INTEGER NOT NULL DEFAULT 0,
  overage_event_cents INTEGER NOT NULL DEFAULT 0,
  overage_attendees_per_100_cents INTEGER NOT NULL DEFAULT 0,
  overage_emails_per_1000_cents INTEGER NOT NULL DEFAULT 0,
  overage_storage_per_5gb_cents INTEGER NOT NULL DEFAULT 0,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone authenticated can view plans" ON public.subscription_plans FOR SELECT TO authenticated USING (true);

-- Seed the 3 plans
INSERT INTO public.subscription_plans (id, name, monthly_price_cents, max_clients, max_active_events, max_attendees, max_emails, max_storage_gb, support_tier, overage_client_cents, overage_event_cents, overage_attendees_per_100_cents, overage_emails_per_1000_cents, overage_storage_per_5gb_cents, display_order) VALUES
('starter', 'Starter', 14900, 3, 5, 500, 2000, 5, 'standard', 2500, 2000, 1000, 1200, 800, 1),
('professional', 'Professional', 39900, 10, 20, 3000, 10000, 20, 'priority', 2000, 1500, 800, 1000, 600, 2),
('enterprise', 'Enterprise', 109900, 30, 75, 15000, 50000, 100, 'premium', 1500, 1000, 600, 800, 500, 3);

-- Account subscriptions (one per user/admin)
CREATE TABLE public.account_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  plan_id TEXT NOT NULL REFERENCES public.subscription_plans(id) DEFAULT 'starter',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT date_trunc('month', now()),
  current_period_end TIMESTAMPTZ NOT NULL DEFAULT (date_trunc('month', now()) + interval '1 month'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.account_subscriptions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own subscription" ON public.account_subscriptions FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can update own subscription" ON public.account_subscriptions FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own subscription" ON public.account_subscriptions FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can view all subscriptions" ON public.account_subscriptions FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_account_subscriptions_updated_at BEFORE UPDATE ON public.account_subscriptions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-create subscription on new user
CREATE OR REPLACE FUNCTION public.handle_new_user_subscription()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.account_subscriptions (user_id, plan_id)
  VALUES (NEW.id, 'starter')
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER on_auth_user_created_subscription AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user_subscription();

-- Monthly usage snapshots
CREATE TABLE public.monthly_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  period_start DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  clients_count INTEGER NOT NULL DEFAULT 0,
  active_events_count INTEGER NOT NULL DEFAULT 0,
  attendees_count INTEGER NOT NULL DEFAULT 0,
  emails_sent_count INTEGER NOT NULL DEFAULT 0,
  storage_used_mb INTEGER NOT NULL DEFAULT 0,
  snapshot_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, period_start)
);

ALTER TABLE public.monthly_usage ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users can view own usage" ON public.monthly_usage FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Users can upsert own usage" ON public.monthly_usage FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own usage" ON public.monthly_usage FOR UPDATE TO authenticated USING (auth.uid() = user_id);
CREATE POLICY "Admins can view all usage" ON public.monthly_usage FOR SELECT TO authenticated USING (has_role(auth.uid(), 'admin'));

-- Grant access
GRANT SELECT ON public.subscription_plans TO authenticated, anon;
GRANT SELECT, INSERT, UPDATE ON public.account_subscriptions TO authenticated;
GRANT SELECT, INSERT, UPDATE ON public.monthly_usage TO authenticated;
