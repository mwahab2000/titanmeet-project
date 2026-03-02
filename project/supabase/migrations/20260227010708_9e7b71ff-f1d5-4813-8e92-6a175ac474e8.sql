
ALTER TABLE public.transport_pickup_points
  ADD COLUMN route_id uuid REFERENCES public.transport_routes(id) ON DELETE CASCADE,
  ADD COLUMN stop_type text NOT NULL DEFAULT 'pickup',
  ADD COLUMN destination text;
