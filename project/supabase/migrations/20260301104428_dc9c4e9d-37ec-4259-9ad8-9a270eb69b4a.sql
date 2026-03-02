
-- Allow public read access to transport_settings for published/ongoing events
CREATE POLICY "Public can view transport_settings of published events"
ON public.transport_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = transport_settings.event_id
    AND e.status IN ('published', 'ongoing')
  )
);

-- Allow public read access to transport_routes for published/ongoing events
CREATE POLICY "Public can view transport_routes of published events"
ON public.transport_routes
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = transport_routes.event_id
    AND e.status IN ('published', 'ongoing')
  )
);

-- Allow public read access to transport_pickup_points for published/ongoing events
CREATE POLICY "Public can view transport_pickup_points of published events"
ON public.transport_pickup_points
FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM events e
    WHERE e.id = transport_pickup_points.event_id
    AND e.status IN ('published', 'ongoing')
  )
);
