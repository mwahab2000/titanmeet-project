-- 1) Foreign key on payment_intents.user_id → auth.users(id) ON DELETE CASCADE
ALTER TABLE public.payment_intents
  ADD CONSTRAINT payment_intents_user_id_fkey
  FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2) Payment status hardening via CHECK constraint
ALTER TABLE public.payment_intents
  ADD CONSTRAINT payment_intents_status_check
  CHECK (status IN ('pending', 'awaiting_payment', 'paid', 'confirmed', 'expired', 'failed', 'cancelled'));

-- 3) Useful indexes
CREATE INDEX IF NOT EXISTS idx_payment_intents_user_id
  ON public.payment_intents (user_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_status
  ON public.payment_intents (status);

CREATE INDEX IF NOT EXISTS idx_payment_intents_provider_payment_id
  ON public.payment_intents (provider_payment_id);

CREATE INDEX IF NOT EXISTS idx_payment_intents_internal_order_id
  ON public.payment_intents (internal_order_id);

CREATE INDEX IF NOT EXISTS idx_payment_events_payment_intent_id
  ON public.payment_events (payment_intent_id);

-- 4) Webhook idempotency: add provider_event_id with unique constraint
ALTER TABLE public.payment_events
  ADD COLUMN IF NOT EXISTS provider_event_id text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_events_provider_event_id_unique
  ON public.payment_events (provider_event_id)
  WHERE provider_event_id IS NOT NULL;

-- 5) Ensure updated_at trigger uses project-standard set_updated_at()
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger
    WHERE tgname = 'set_payment_intents_updated_at'
      AND tgrelid = 'public.payment_intents'::regclass
  ) THEN
    CREATE TRIGGER set_payment_intents_updated_at
      BEFORE UPDATE ON public.payment_intents
      FOR EACH ROW
      EXECUTE FUNCTION public.set_updated_at();
  END IF;
END;
$$;