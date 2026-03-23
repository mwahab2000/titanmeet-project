
-- Discount codes table
CREATE TABLE public.discount_codes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL,
  description text,
  is_active boolean NOT NULL DEFAULT true,
  paddle_discount_id text,
  discount_type text NOT NULL DEFAULT 'percent',
  discount_value numeric NOT NULL DEFAULT 0,
  applicable_plans jsonb NOT NULL DEFAULT '["starter","professional","enterprise"]'::jsonb,
  applicable_intervals jsonb NOT NULL DEFAULT '["monthly","annual"]'::jsonb,
  duration_type text NOT NULL DEFAULT 'once',
  duration_cycles integer,
  max_redemptions integer,
  max_redemptions_per_customer integer DEFAULT 1,
  starts_at timestamptz,
  expires_at timestamptz,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT discount_codes_code_unique UNIQUE (code)
);

-- Normalize code to uppercase
CREATE OR REPLACE FUNCTION public.normalize_discount_code()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
BEGIN
  NEW.code := UPPER(TRIM(NEW.code));
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_normalize_discount_code
  BEFORE INSERT OR UPDATE ON public.discount_codes
  FOR EACH ROW EXECUTE FUNCTION public.normalize_discount_code();

-- Discount code redemptions table
CREATE TABLE public.discount_code_redemptions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  discount_code_id uuid NOT NULL REFERENCES public.discount_codes(id) ON DELETE CASCADE,
  user_id uuid,
  customer_email text,
  subscription_id text,
  paddle_customer_id text,
  paddle_transaction_id text,
  plan_applied text NOT NULL,
  billing_interval text NOT NULL DEFAULT 'monthly',
  redeemed_at timestamptz NOT NULL DEFAULT now(),
  metadata jsonb DEFAULT '{}'::jsonb
);

-- Indexes
CREATE INDEX idx_discount_codes_code ON public.discount_codes(code);
CREATE INDEX idx_discount_codes_active ON public.discount_codes(is_active) WHERE is_active = true;
CREATE INDEX idx_discount_redemptions_code ON public.discount_code_redemptions(discount_code_id);
CREATE INDEX idx_discount_redemptions_user ON public.discount_code_redemptions(user_id);

-- RLS
ALTER TABLE public.discount_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.discount_code_redemptions ENABLE ROW LEVEL SECURITY;

-- Admin/owner can manage discount codes
CREATE POLICY "Admins can manage discount codes"
  ON public.discount_codes FOR ALL
  TO authenticated
  USING (is_admin() OR is_owner())
  WITH CHECK (is_admin() OR is_owner());

-- Service role full access
CREATE POLICY "Service role full access discount_codes"
  ON public.discount_codes FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

-- Admins can view redemptions
CREATE POLICY "Admins can view discount redemptions"
  ON public.discount_code_redemptions FOR SELECT
  TO authenticated
  USING (is_admin() OR is_owner());

-- Users can view own redemptions
CREATE POLICY "Users can view own redemptions"
  ON public.discount_code_redemptions FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- Service role full access redemptions
CREATE POLICY "Service role full access discount_redemptions"
  ON public.discount_code_redemptions FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);
