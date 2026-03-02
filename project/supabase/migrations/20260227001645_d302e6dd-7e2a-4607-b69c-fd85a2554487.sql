
-- 1) transport_settings
CREATE TABLE public.transport_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE UNIQUE,
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'none' CHECK (mode IN ('none','shuttle','private_car','taxi_reimb','other')),
  meetup_time time NULL,
  general_instructions text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transport_settings FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.transport_settings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage transport_settings" ON public.transport_settings FOR ALL TO authenticated USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 2) transport_pickup_points
CREATE TABLE public.transport_pickup_points (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  address text NULL,
  map_url text NULL,
  pickup_time time NULL,
  notes text NULL,
  order_index int NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_pickup_points_event ON public.transport_pickup_points(event_id, order_index);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transport_pickup_points FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.transport_pickup_points ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage transport_pickup_points" ON public.transport_pickup_points FOR ALL TO authenticated USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 3) transport_routes
CREATE TABLE public.transport_routes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  vehicle_type text NULL,
  capacity int NULL,
  departure_time time NULL,
  driver_name text NULL,
  driver_mobile text NULL,
  notes text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_routes_event ON public.transport_routes(event_id);
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.transport_routes FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage transport_routes" ON public.transport_routes FOR ALL TO authenticated USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 4) attendee_transport_assignments
CREATE TABLE public.attendee_transport_assignments (
  attendee_id uuid PRIMARY KEY REFERENCES public.attendees(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  pickup_point_id uuid NULL REFERENCES public.transport_pickup_points(id) ON DELETE SET NULL,
  route_id uuid NULL REFERENCES public.transport_routes(id) ON DELETE SET NULL,
  seat_number text NULL,
  special_needs text NULL,
  assigned_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_assign_event ON public.attendee_transport_assignments(event_id);
CREATE INDEX idx_assign_pickup ON public.attendee_transport_assignments(pickup_point_id);
CREATE INDEX idx_assign_route ON public.attendee_transport_assignments(route_id);
ALTER TABLE public.attendee_transport_assignments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Event owners can manage attendee_transport_assignments" ON public.attendee_transport_assignments FOR ALL TO authenticated USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 5) v_transport_overview view
CREATE OR REPLACE VIEW public.v_transport_overview AS
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

-- 6) v_pickup_point_counts view
CREATE OR REPLACE VIEW public.v_pickup_point_counts AS
SELECT
  pp.event_id,
  pp.id AS pickup_point_id,
  pp.name AS pickup_name,
  pp.pickup_time,
  (SELECT count(*) FROM public.attendee_transport_assignments ata WHERE ata.pickup_point_id = pp.id) AS assigned_count
FROM public.transport_pickup_points pp;
