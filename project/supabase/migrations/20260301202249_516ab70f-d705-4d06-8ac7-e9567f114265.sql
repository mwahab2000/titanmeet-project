DROP POLICY IF EXISTS "Event owners can manage attendees" ON public.attendees;

CREATE POLICY "Event owners can manage attendees"
ON public.attendees
AS PERMISSIVE
FOR ALL
TO authenticated
USING (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendees.event_id
      AND (
        e.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = attendees.event_id
      AND (
        e.created_by = auth.uid()
        OR public.has_role(auth.uid(), 'admin'::public.app_role)
      )
  )
);