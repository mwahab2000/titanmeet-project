
-- Drop all RESTRICTIVE policies on dress_codes and recreate as PERMISSIVE
DROP POLICY IF EXISTS "Users can view dress codes for their events" ON public.dress_codes;
DROP POLICY IF EXISTS "Users can insert dress codes for their events" ON public.dress_codes;
DROP POLICY IF EXISTS "Users can update dress codes for their events" ON public.dress_codes;
DROP POLICY IF EXISTS "Users can delete dress codes for their events" ON public.dress_codes;
DROP POLICY IF EXISTS "Public can view dress codes of published events" ON public.dress_codes;

-- Recreate as PERMISSIVE
CREATE POLICY "Users can view dress codes for their events"
  ON public.dress_codes FOR SELECT TO authenticated
  USING (owns_event(event_id));

CREATE POLICY "Users can insert dress codes for their events"
  ON public.dress_codes FOR INSERT TO authenticated
  WITH CHECK (owns_event(event_id));

CREATE POLICY "Users can update dress codes for their events"
  ON public.dress_codes FOR UPDATE TO authenticated
  USING (owns_event(event_id));

CREATE POLICY "Users can delete dress codes for their events"
  ON public.dress_codes FOR DELETE TO authenticated
  USING (owns_event(event_id));

CREATE POLICY "Public can view dress codes of published events"
  ON public.dress_codes FOR SELECT TO anon, authenticated
  USING (EXISTS (
    SELECT 1 FROM public.events e
    WHERE e.id = event_id AND e.status IN ('published', 'ongoing')
  ));
