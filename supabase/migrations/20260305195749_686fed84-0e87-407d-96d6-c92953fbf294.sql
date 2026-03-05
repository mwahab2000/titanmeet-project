
-- is_owner(): checks if current user has 'owner' role
CREATE OR REPLACE FUNCTION public.is_owner()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = 'owner'
  )
$$;

-- assert_owner(): raises exception if not owner
CREATE OR REPLACE FUNCTION public.assert_owner()
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  IF NOT public.is_owner() THEN
    RAISE EXCEPTION 'Owner privileges required' USING ERRCODE = '42501';
  END IF;
END;
$$;

-- Owner-only billing confirmation RPC (race-safe, idempotent)
CREATE OR REPLACE FUNCTION public.owner_confirm_payment_intent(
  _intent_id uuid, _notes text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _intent RECORD;
  _sub RECORD;
  _new_period_end timestamptz;
BEGIN
  PERFORM public.assert_owner();

  UPDATE public.payment_intents
  SET status = 'confirmed', paid_at = COALESCE(paid_at, now()), updated_at = now()
  WHERE id = _intent_id
    AND status NOT IN ('confirmed', 'refunded', 'cancelled', 'failed')
  RETURNING * INTO _intent;

  IF _intent IS NULL THEN
    IF EXISTS (SELECT 1 FROM public.payment_intents WHERE id = _intent_id AND status = 'confirmed') THEN
      RETURN jsonb_build_object('status', 'already_confirmed', 'intent_id', _intent_id);
    END IF;
    RAISE EXCEPTION 'Payment intent not found or in a non-confirmable state';
  END IF;

  INSERT INTO public.payment_events (payment_intent_id, event_type, provider, raw_payload)
  VALUES (_intent_id, 'manual_confirm', 'owner', jsonb_build_object('actor', auth.uid()::text, 'notes', _notes));

  SELECT * INTO _sub FROM public.account_subscriptions WHERE user_id = _intent.user_id;
  IF FOUND THEN
    _new_period_end := GREATEST(_sub.current_period_end, now()) + interval '30 days';
    UPDATE public.account_subscriptions
    SET plan_id = _intent.plan_id, status = 'active',
        current_period_start = now(), current_period_end = _new_period_end, updated_at = now()
    WHERE user_id = _intent.user_id;
  ELSE
    INSERT INTO public.account_subscriptions (user_id, plan_id, status, current_period_start, current_period_end)
    VALUES (_intent.user_id, _intent.plan_id, 'active', now(), now() + interval '30 days');
  END IF;

  INSERT INTO public.admin_audit_log (actor_user_id, action_type, target_id, details)
  VALUES (auth.uid(), 'owner_confirm_payment', _intent_id::text, jsonb_build_object(
    'plan_id', _intent.plan_id, 'user_id', _intent.user_id::text,
    'amount_cents', _intent.amount_usd_cents, 'notes', _notes));

  RETURN jsonb_build_object('status', 'confirmed', 'intent_id', _intent_id);
END;
$$;

-- Redirect old admin RPC → owner check
CREATE OR REPLACE FUNCTION public.admin_confirm_payment_intent(
  _intent_id uuid, _notes text DEFAULT ''
) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  RETURN public.owner_confirm_payment_intent(_intent_id, _notes);
END;
$$;

-- RLS: billing mutations → owner only
DROP POLICY IF EXISTS "Admins can update payment intents" ON public.payment_intents;
CREATE POLICY "Owners can update payment intents" ON public.payment_intents FOR UPDATE TO authenticated USING (is_owner());

DROP POLICY IF EXISTS "Admins can insert payment events" ON public.payment_events;
CREATE POLICY "Owners can insert payment events" ON public.payment_events FOR INSERT TO authenticated WITH CHECK (is_owner());

DROP POLICY IF EXISTS "Admins can update all subscriptions" ON public.account_subscriptions;
CREATE POLICY "Owners can update all subscriptions" ON public.account_subscriptions FOR UPDATE TO authenticated USING (is_owner());

-- Audit log: readable by admins AND owners
DROP POLICY IF EXISTS "Admins can view audit log" ON public.admin_audit_log;
CREATE POLICY "Admins and owners can view audit log" ON public.admin_audit_log FOR SELECT TO authenticated USING (is_admin() OR is_owner());

GRANT EXECUTE ON FUNCTION public.is_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.assert_owner() TO authenticated;
GRANT EXECUTE ON FUNCTION public.owner_confirm_payment_intent(uuid, text) TO authenticated;
