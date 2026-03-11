GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.event_invites TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_logs TO service_role;
GRANT SELECT ON public.events TO service_role;
GRANT SELECT ON public.clients TO service_role;