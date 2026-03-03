
-- =====================================================
-- RLS HARDENING: Draft event data privacy
-- =====================================================

-- 1. Create reusable helper function
CREATE OR REPLACE FUNCTION public.is_event_public(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id
    AND status IN ('published', 'ongoing')
  )
$$;

-- =====================================================
-- 2. AGENDA_ITEMS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view agenda_items" ON public.agenda_items;
CREATE POLICY "Public can view agenda_items of published events"
  ON public.agenda_items FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 3. ANNOUNCEMENTS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view announcements" ON public.announcements;
CREATE POLICY "Public can view announcements of published events"
  ON public.announcements FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 4. SPEAKERS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view speakers" ON public.speakers;
CREATE POLICY "Public can view speakers of published events"
  ON public.speakers FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 5. ORGANIZERS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view organizers" ON public.organizers;
CREATE POLICY "Public can view organizers of published events"
  ON public.organizers FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 6. EVENT_SESSIONS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view sessions" ON public.event_sessions;
CREATE POLICY "Public can view sessions of published events"
  ON public.event_sessions FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 7. EVENT_SPEAKERS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view speakers" ON public.event_speakers;
CREATE POLICY "Public can view event_speakers of published events"
  ON public.event_speakers FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 8. SURVEY_QUESTIONS: Drop broad policy, add hardened one
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view survey_questions" ON public.survey_questions;
CREATE POLICY "Public can view survey_questions of published events"
  ON public.survey_questions FOR SELECT
  USING (is_event_public(event_id) OR owns_event(event_id));

-- =====================================================
-- 9. SURVEYS: Harden to also require parent event public
--    Old: USING (status = 'published') — leaks if event is draft
-- =====================================================
DROP POLICY IF EXISTS "Anyone can view published surveys" ON public.surveys;
CREATE POLICY "Public can view published surveys of published events"
  ON public.surveys FOR SELECT
  USING ((status = 'published' AND is_event_public(event_id)) OR owns_event(event_id));

-- =====================================================
-- 10. DRESS_CODES: Already has public-status check ✅
--     But also has "Users can view dress codes for their events"
--     which uses owns_event — that's correct, no change needed.
-- =====================================================

-- =====================================================
-- 11. TRANSPORT tables: Already hardened ✅ (no changes)
--     transport_settings, transport_routes, transport_pickup_points
-- =====================================================

-- =====================================================
-- 12. Tables that should REMAIN owner-only (NO public read):
--     attendees ✅ (owner-only)
--     attendee_groups ✅ (owner-only)
--     attendee_transport_assignments ✅ (owner-only)
--     communications_log ✅ (owner-only)
--     rsvp_tokens ✅ (owner-only)
--     survey_responses ✅ (owner-only)
--     survey_answers ✅ (owner-only)
--     groups ✅ (owner-only)
-- =====================================================

-- =====================================================
-- 13. EVENTS table: Already correct ✅
--     Current policy: published/ongoing OR owner OR admin
--     No change needed.
-- =====================================================
