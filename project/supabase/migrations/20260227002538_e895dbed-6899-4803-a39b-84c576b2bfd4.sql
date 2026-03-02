
DROP VIEW IF EXISTS public.v_transport_overview;

ALTER TABLE public.transport_settings ALTER COLUMN meetup_time TYPE text USING meetup_time::text;

CREATE OR REPLACE VIEW public.v_transport_overview WITH (security_invoker = on) AS
SELECT
  ts.event_id,
  ts.enabled,
  ts.mode,
  ts.meetup_time,
  (SELECT count(*) FROM public.attendees a WHERE a.event_id = ts.event_id) AS total_attendees,
  (SELECT count(*) FROM public.attendee_transport_assignments ata WHERE ata.event_id = ts.event_id AND (ata.pickup_point_id IS NOT NULL OR ata.route_id IS NOT NULL)) AS assigned_count,
  (SELECT count(*) FROM public.attendees a WHERE a.event_id = ts.event_id) -
  (SELECT count(*) FROM public.attendee_transport_assignments ata WHERE ata.event_id = ts.event_id AND (ata.pickup_point_id IS NOT NULL OR ata.route_id IS NOT NULL)) AS unassigned_count
FROM public.transport_settings ts;
