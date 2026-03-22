-- Grant service_role access to user_roles for AI Builder authorization checks
GRANT SELECT ON public.user_roles TO service_role;
-- Also grant event_invites for readiness checks
GRANT SELECT ON public.event_invites TO service_role;