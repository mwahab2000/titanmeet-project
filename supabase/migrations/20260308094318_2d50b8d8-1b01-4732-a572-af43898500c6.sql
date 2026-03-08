-- Grant table-level access for subscription_plans and billing tables
GRANT SELECT ON public.subscription_plans TO authenticated, anon, service_role;
GRANT SELECT, INSERT, UPDATE ON public.payment_intents TO authenticated, service_role;
GRANT SELECT, INSERT ON public.payment_events TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.account_subscriptions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.account_entitlements TO authenticated, service_role;
