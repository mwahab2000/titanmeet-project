
-- Add unique constraint on account_entitlements.user_id for upsert support
ALTER TABLE public.account_entitlements
  ADD CONSTRAINT account_entitlements_user_id_unique UNIQUE (user_id);

-- Ensure subscription_plans slugs are correct
UPDATE public.subscription_plans SET slug = 'starter' WHERE name ILIKE '%starter%' AND (slug IS NULL OR slug != 'starter');
UPDATE public.subscription_plans SET slug = 'professional' WHERE name ILIKE '%professional%' AND (slug IS NULL OR slug != 'professional');
UPDATE public.subscription_plans SET slug = 'enterprise' WHERE name ILIKE '%enterprise%' AND (slug IS NULL OR slug != 'enterprise');
