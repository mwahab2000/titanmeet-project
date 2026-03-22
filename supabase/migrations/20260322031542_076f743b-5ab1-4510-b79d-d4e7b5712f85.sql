-- API usage tracking table
CREATE TABLE public.api_usage_tracking (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  resource_type text NOT NULL,
  period_start timestamp with time zone NOT NULL DEFAULT date_trunc('month', now()),
  usage_count integer NOT NULL DEFAULT 0,
  last_request_at timestamp with time zone DEFAULT now(),
  burst_count integer NOT NULL DEFAULT 0,
  burst_window_start timestamp with time zone DEFAULT now(),
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  UNIQUE(user_id, resource_type, period_start)
);

ALTER TABLE public.api_usage_tracking ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own usage" ON public.api_usage_tracking
  FOR SELECT TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Service role full access" ON public.api_usage_tracking
  FOR ALL TO service_role USING (true) WITH CHECK (true);

CREATE INDEX idx_api_usage_user_resource ON public.api_usage_tracking (user_id, resource_type, period_start);

ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS max_ai_requests integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_ai_heavy integer NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS max_maps_searches integer NOT NULL DEFAULT 50,
  ADD COLUMN IF NOT EXISTS max_maps_photos integer NOT NULL DEFAULT 100,
  ADD COLUMN IF NOT EXISTS max_whatsapp_sends integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS burst_per_minute integer NOT NULL DEFAULT 10;

GRANT SELECT, INSERT, UPDATE ON public.api_usage_tracking TO service_role;
GRANT SELECT, INSERT, UPDATE ON public.api_usage_tracking TO authenticated;

CREATE TRIGGER set_api_usage_updated_at
  BEFORE UPDATE ON public.api_usage_tracking
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();