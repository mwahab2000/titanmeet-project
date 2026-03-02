
-- Drop the restrictive policy and recreate as permissive
DROP POLICY IF EXISTS "Event owners can manage attendees" ON public.attendees;

CREATE POLICY "Event owners can manage attendees"
ON public.attendees
FOR ALL
TO authenticated
USING (owns_event(event_id))
WITH CHECK (owns_event(event_id));
