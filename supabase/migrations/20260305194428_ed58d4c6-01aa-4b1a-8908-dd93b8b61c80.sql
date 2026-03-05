
-- ============================================================
-- SERVER-SIDE ADMIN SECURITY: functions, audit table, RLS hardening
-- ============================================================

-- (1) is_admin(): parameterless, uses auth.uid() so cannot be spoofed
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'admin'
  )
$$;

-- assert_admin(): raises exception if caller is not admin
CREATE OR REPLACE FUNCTION public.assert_admin()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Admin privileges required' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- (5) Audit log for admin actions
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_user_id uuid NOT NULL,
  action_type text NOT NULL,
  target_id text,
  details jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;

-- Only admins can read audit log; inserts happen via SECURITY DEFINER RPCs
CREATE POLICY "Admins can view audit log"
  ON public.admin_audit_log FOR SELECT
  USING (public.is_admin());

-- No direct insert/update/delete for anyone via API
-- Inserts happen inside SECURITY DEFINER functions only

-- Grant API access
GRANT SELECT ON public.admin_audit_log TO authenticated;

-- (3) admin_confirm_payment_intent RPC
CREATE OR REPLACE FUNCTION public.admin_confirm_payment_intent(
  _intent_id uuid,
  _notes text DEFAULT ''
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _intent RECORD;
  _sub RECORD;
  _new_period_end timestamptz;
BEGIN
  -- Enforce admin
  PERFORM public.assert_admin();

  -- Get payment intent
  SELECT * INTO _intent FROM public.payment_intents WHERE id = _intent_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Payment intent not found';
  END IF;

  -- Idempotent: if already confirmed, return early
  IF _intent.status = 'confirmed' THEN
    RETURN jsonb_build_object('status', 'already_confirmed', 'intent_id', _intent_id);
  END IF;

  -- Update payment intent to confirmed
  UPDATE public.payment_intents
  SET status = 'confirmed',
      paid_at = COALESCE(paid_at, now()),
      updated_at = now()
  WHERE id = _intent_id;

  -- Insert payment event
  INSERT INTO public.payment_events (payment_intent_id, event_type, provider, raw_payload)
  VALUES (_intent_id, 'manual_confirm', 'admin', jsonb_build_object(
    'actor', auth.uid()::text,
    'notes', _notes
  ));

  -- Activate/extend subscription
  SELECT * INTO _sub FROM public.account_subscriptions WHERE user_id = _intent.user_id;

  IF FOUND THEN
    -- Extend by 30 days from current period end or now, whichever is later
    _new_period_end := GREATEST(_sub.current_period_end, now()) + interval '30 days';
    UPDATE public.account_subscriptions
    SET plan_id = _intent.plan_id,
        status = 'active',
        current_period_start = now(),
        current_period_end = _new_period_end,
        updated_at = now()
    WHERE user_id = _intent.user_id;
  ELSE
    INSERT INTO public.account_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
    VALUES (_intent.user_id, _intent.plan_id, 'active', now(), now() + interval '30 days');
  END IF;

  -- Audit log
  INSERT INTO public.admin_audit_log (actor_user_id, action_type, target_id, details)
  VALUES (auth.uid(), 'confirm_payment', _intent_id::text, jsonb_build_object(
    'plan_id', _intent.plan_id,
    'user_id', _intent.user_id::text,
    'amount_cents', _intent.amount_usd_cents,
    'notes', _notes
  ));

  RETURN jsonb_build_object('status', 'confirmed', 'intent_id', _intent_id);
END;
$$;

-- (4) Admin ticket status change RPC
CREATE OR REPLACE FUNCTION public.admin_update_ticket_status(
  _ticket_id uuid,
  _new_status text,
  _resolved_at timestamptz DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  PERFORM public.assert_admin();

  UPDATE public.support_tickets
  SET status = _new_status::ticket_status,
      resolved_at = _resolved_at,
      updated_at = now()
  WHERE id = _ticket_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Ticket not found';
  END IF;

  INSERT INTO public.admin_audit_log (actor_user_id, action_type, target_id, details)
  VALUES (auth.uid(), 'update_ticket_status', _ticket_id::text, jsonb_build_object(
    'new_status', _new_status
  ));
END;
$$;

-- Grant execute on new functions
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_admin() TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_confirm_payment_intent(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.admin_update_ticket_status(uuid, text, timestamptz) TO authenticated;

-- (2) Harden RLS: Add admin-only UPDATE policy on payment_intents
-- payment_intents already blocks UPDATE/DELETE for non-admins (no policies exist).
-- Add explicit admin update policy:
CREATE POLICY "Admins can update payment intents"
  ON public.payment_intents FOR UPDATE
  USING (public.is_admin());

-- Add admin insert policy for payment_events (webhooks use service role, this covers admin manual)
CREATE POLICY "Admins can insert payment events"
  ON public.payment_events FOR INSERT
  WITH CHECK (public.is_admin());

-- Admin can update all subscriptions
CREATE POLICY "Admins can update all subscriptions"
  ON public.account_subscriptions FOR UPDATE
  USING (public.is_admin());
