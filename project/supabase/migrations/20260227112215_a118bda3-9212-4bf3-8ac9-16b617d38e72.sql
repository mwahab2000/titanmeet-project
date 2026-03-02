DROP VIEW IF EXISTS public.v_pickup_point_counts;

ALTER TABLE public.transport_pickup_points
  ALTER COLUMN pickup_time TYPE text USING pickup_time::text;

CREATE OR REPLACE VIEW public.v_pickup_point_counts WITH (security_invoker = on) AS
  SELECT pp.id AS pickup_point_id, pp.event_id, pp.name AS pickup_name, pp.pickup_time,
    count(ata.attendee_id) AS assigned_count
  FROM transport_pickup_points pp
  LEFT JOIN attendee_transport_assignments ata ON ata.pickup_point_id = pp.id
  GROUP BY pp.id, pp.event_id, pp.name, pp.pickup_time;