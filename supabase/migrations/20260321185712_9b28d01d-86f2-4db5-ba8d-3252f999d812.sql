-- Harden billing: change provider default from 'paypal' to 'paddle'
ALTER TABLE public.account_subscriptions ALTER COLUMN provider SET DEFAULT 'paddle';

-- Clean up payment tables: change provider default from 'triple_a' to 'paddle'
ALTER TABLE public.payment_intents ALTER COLUMN provider SET DEFAULT 'paddle';
ALTER TABLE public.payment_events ALTER COLUMN provider SET DEFAULT 'paddle';

-- Drop deprecated voice tables (no longer used after voice feature removal)
DROP TABLE IF EXISTS public.voice_action_log CASCADE;
DROP TABLE IF EXISTS public.voice_usage CASCADE;
DROP TABLE IF EXISTS public.voice_sessions CASCADE;