
-- 1. Add 'archived' to event_status enum
ALTER TYPE public.event_status ADD VALUE IF NOT EXISTS 'archived';

-- 2. Create clients table
CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;

-- 3. Alter events table
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS client_id uuid REFERENCES public.clients(id),
  ADD COLUMN IF NOT EXISTS slug text,
  ADD COLUMN IF NOT EXISTS event_date date,
  ADD COLUMN IF NOT EXISTS hero_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS venue_images jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS venue_name text,
  ADD COLUMN IF NOT EXISTS venue_address text,
  ADD COLUMN IF NOT EXISTS venue_notes text,
  ADD COLUMN IF NOT EXISTS venue_map_link text,
  ADD COLUMN IF NOT EXISTS transportation_notes text,
  ADD COLUMN IF NOT EXISTS transportation_pickups jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS transportation_schedule jsonb DEFAULT '[]'::jsonb;

-- 4. Create organizers table
CREATE TABLE public.organizers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  role text,
  email text,
  mobile text,
  photo_url text
);
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;

-- 5. Create attendees table (workspace-level, separate from event_attendees)
CREATE TABLE public.attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  email text NOT NULL,
  mobile text,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz
);
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;

-- 6. Create groups table
CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  name text NOT NULL,
  capacity integer
);
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;

-- 7. Create attendee_groups junction table
CREATE TABLE public.attendee_groups (
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  group_id uuid NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  PRIMARY KEY (attendee_id, group_id)
);
ALTER TABLE public.attendee_groups ENABLE ROW LEVEL SECURITY;

-- 8. Create agenda_items table
CREATE TABLE public.agenda_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  start_time time,
  end_time time
);
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;

-- 9. Create announcements table
CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  text text NOT NULL,
  start_date date,
  end_date date,
  order_index integer NOT NULL DEFAULT 0
);
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;

-- 10. Create survey_questions table
CREATE TABLE public.survey_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  type text NOT NULL DEFAULT 'short_text',
  question text NOT NULL,
  options jsonb DEFAULT '[]'::jsonb,
  required boolean NOT NULL DEFAULT false,
  enabled boolean NOT NULL DEFAULT true
);
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;

-- 11. Create communications_log table
CREATE TABLE public.communications_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid REFERENCES public.attendees(id) ON DELETE SET NULL,
  channel text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;

-- 12. Create rsvp_tokens table
CREATE TABLE public.rsvp_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) ON DELETE CASCADE,
  token uuid NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  expires_at timestamptz,
  used_at timestamptz
);
ALTER TABLE public.rsvp_tokens ENABLE ROW LEVEL SECURITY;

-- 13. Storage bucket for event assets
INSERT INTO storage.buckets (id, name, public) VALUES ('event-assets', 'event-assets', true);

-- 14. RLS policies for clients
CREATE POLICY "Owners can manage own clients" ON public.clients FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage all clients" ON public.clients FOR ALL USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- 15. Helper function: check if user owns event
CREATE OR REPLACE FUNCTION public.owns_event(_event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = _event_id AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  )
$$;

-- 16. RLS for organizers
CREATE POLICY "Event owners can manage organizers" ON public.organizers FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view organizers" ON public.organizers FOR SELECT USING (true);

-- 17. RLS for attendees
CREATE POLICY "Event owners can manage attendees" ON public.attendees FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 18. RLS for groups
CREATE POLICY "Event owners can manage groups" ON public.groups FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 19. RLS for attendee_groups
CREATE POLICY "Event owners can manage attendee_groups" ON public.attendee_groups FOR ALL
USING (EXISTS (SELECT 1 FROM public.attendees a WHERE a.id = attendee_id AND owns_event(a.event_id)))
WITH CHECK (EXISTS (SELECT 1 FROM public.attendees a WHERE a.id = attendee_id AND owns_event(a.event_id)));

-- 20. RLS for agenda_items
CREATE POLICY "Event owners can manage agenda_items" ON public.agenda_items FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view agenda_items" ON public.agenda_items FOR SELECT USING (true);

-- 21. RLS for announcements
CREATE POLICY "Event owners can manage announcements" ON public.announcements FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);

-- 22. RLS for survey_questions
CREATE POLICY "Event owners can manage survey_questions" ON public.survey_questions FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Anyone can view survey_questions" ON public.survey_questions FOR SELECT USING (true);

-- 23. RLS for communications_log
CREATE POLICY "Event owners can manage communications_log" ON public.communications_log FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 24. RLS for rsvp_tokens
CREATE POLICY "Event owners can manage rsvp_tokens" ON public.rsvp_tokens FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 25. Storage policies for event-assets bucket
CREATE POLICY "Authenticated users can upload event assets" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'event-assets');
CREATE POLICY "Anyone can view event assets" ON storage.objects FOR SELECT USING (bucket_id = 'event-assets');
CREATE POLICY "Authenticated users can update own event assets" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'event-assets');
CREATE POLICY "Authenticated users can delete own event assets" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'event-assets');
