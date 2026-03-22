-- Grant service_role full access to tables used by AI Builder edge function
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.events TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.attendees TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.agenda_items TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.organizers TO service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.speakers TO service_role;

-- Also grant authenticated role proper access to clients (needed for normal UI)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clients TO authenticated;
GRANT SELECT ON public.clients TO anon;