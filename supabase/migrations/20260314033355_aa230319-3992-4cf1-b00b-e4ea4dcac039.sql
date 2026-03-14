
-- Allow public to read attendee names for published/ongoing events
CREATE POLICY "Public can view attendee names of published events"
ON public.attendees
FOR SELECT
TO anon, authenticated
USING (is_event_public(event_id));

-- Allow public to read groups for published/ongoing events
CREATE POLICY "Public can view groups of published events"
ON public.groups
FOR SELECT
TO anon, authenticated
USING (is_event_public(event_id));

-- Allow public to read attendee_groups for published/ongoing events
CREATE POLICY "Public can view attendee_groups of published events"
ON public.attendee_groups
FOR SELECT
TO anon, authenticated
USING (
  EXISTS (
    SELECT 1 FROM public.attendees a
    WHERE a.id = attendee_groups.attendee_id
    AND is_event_public(a.event_id)
  )
);
