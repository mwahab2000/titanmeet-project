-- =====================================================
-- TitanMeet Full Database Schema Export
-- Run this in your own Supabase project's SQL Editor
-- =====================================================

-- 1. ENUMS
CREATE TYPE public.app_role AS ENUM ('admin', 'moderator', 'user');
CREATE TYPE public.attendee_status AS ENUM ('registered', 'confirmed', 'checked_in', 'cancelled');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'ongoing', 'completed', 'cancelled', 'archived');

-- 2. TABLES

CREATE TABLE public.clients (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name text NOT NULL,
  slug text NOT NULL UNIQUE,
  logo_url text,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.events (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  title text NOT NULL,
  description text,
  location text,
  venue text,
  start_date timestamptz NOT NULL,
  end_date timestamptz NOT NULL,
  cover_image text,
  max_attendees integer,
  status event_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_id uuid REFERENCES public.clients(id),
  slug text,
  event_date date,
  hero_images jsonb DEFAULT '[]',
  venue_images jsonb DEFAULT '[]',
  venue_name text,
  venue_address text,
  venue_notes text,
  venue_map_link text,
  transportation_notes text,
  transportation_pickups jsonb DEFAULT '[]',
  transportation_schedule jsonb DEFAULT '[]',
  theme_id text NOT NULL DEFAULT 'corporate',
  gallery_images jsonb DEFAULT '[]'
);

CREATE TABLE public.profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL UNIQUE,
  full_name text,
  avatar_url text,
  phone text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.user_roles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id uuid NOT NULL,
  role app_role NOT NULL DEFAULT 'user'
);

CREATE TABLE public.attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  email text NOT NULL,
  mobile text,
  confirmed boolean NOT NULL DEFAULT false,
  confirmed_at timestamptz,
  invitation_sent boolean NOT NULL DEFAULT false
);

CREATE TABLE public.speakers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  title text,
  bio text,
  photo_url text,
  linkedin_url text
);

CREATE TABLE public.agenda_items (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  title text NOT NULL,
  description text,
  order_index integer NOT NULL DEFAULT 0,
  start_time time,
  end_time time,
  day_number integer DEFAULT 1,
  speaker_id uuid REFERENCES public.speakers(id)
);

CREATE TABLE public.announcements (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  text text NOT NULL,
  start_date date,
  end_date date,
  order_index integer NOT NULL DEFAULT 0
);

CREATE TABLE public.groups (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  capacity integer
);

CREATE TABLE public.attendee_groups (
  attendee_id uuid NOT NULL REFERENCES public.attendees(id),
  group_id uuid NOT NULL REFERENCES public.groups(id),
  PRIMARY KEY (attendee_id, group_id)
);

CREATE TABLE public.organizers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  role text,
  email text,
  mobile text,
  photo_url text
);

CREATE TABLE public.dress_codes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  day_number integer NOT NULL DEFAULT 1,
  dress_type text NOT NULL DEFAULT 'business_casual',
  custom_instructions text,
  reference_images jsonb DEFAULT '[]',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.communications_log (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  attendee_id uuid REFERENCES public.attendees(id),
  channel text NOT NULL,
  subject text,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  created_at timestamptz NOT NULL DEFAULT now(),
  recipient_info text
);

CREATE TABLE public.rsvp_tokens (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  attendee_id uuid NOT NULL REFERENCES public.attendees(id),
  token uuid NOT NULL DEFAULT gen_random_uuid(),
  expires_at timestamptz,
  used_at timestamptz
);

CREATE TABLE public.event_attendees (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  user_id uuid NOT NULL,
  status attendee_status NOT NULL DEFAULT 'registered',
  ticket_number text,
  registered_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_sessions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  title text NOT NULL,
  description text,
  start_time timestamptz NOT NULL,
  end_time timestamptz NOT NULL,
  location text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.event_speakers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  title text,
  bio text,
  avatar_url text,
  session_id uuid REFERENCES public.event_sessions(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.surveys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  title text NOT NULL DEFAULT 'Untitled Survey',
  description text,
  status text NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_questions (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.surveys(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  question_text text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'short_text',
  required boolean NOT NULL DEFAULT false,
  order_index integer NOT NULL DEFAULT 0,
  settings jsonb NOT NULL DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_responses (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id uuid NOT NULL REFERENCES public.surveys(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  respondent_id uuid,
  respondent_email text,
  status text NOT NULL DEFAULT 'in_progress',
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.survey_answers (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  response_id uuid NOT NULL REFERENCES public.survey_responses(id),
  question_id uuid NOT NULL REFERENCES public.survey_questions(id),
  event_id uuid NOT NULL REFERENCES public.events(id),
  value_text text,
  value_number numeric,
  value_date date,
  value_json jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL UNIQUE REFERENCES public.events(id),
  enabled boolean NOT NULL DEFAULT false,
  mode text NOT NULL DEFAULT 'none',
  meetup_time text,
  general_instructions text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.transport_routes (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  vehicle_type text,
  capacity integer,
  departure_time time,
  driver_name text,
  driver_mobile text,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  day_number integer
);

CREATE TABLE public.transport_pickup_points (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  name text NOT NULL,
  address text,
  map_url text,
  pickup_time text,
  notes text,
  order_index integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  route_id uuid REFERENCES public.transport_routes(id),
  stop_type text NOT NULL DEFAULT 'pickup',
  destination text
);

CREATE TABLE public.attendee_transport_assignments (
  attendee_id uuid NOT NULL REFERENCES public.attendees(id) PRIMARY KEY,
  event_id uuid NOT NULL REFERENCES public.events(id),
  pickup_point_id uuid REFERENCES public.transport_pickup_points(id),
  route_id uuid REFERENCES public.transport_routes(id),
  seat_number text,
  special_needs text,
  assigned_at timestamptz NOT NULL DEFAULT now()
);

-- 3. FUNCTIONS

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  INSERT INTO public.profiles (user_id, full_name, avatar_url)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'full_name', NEW.raw_user_meta_data->>'name', ''),
    COALESCE(NEW.raw_user_meta_data->>'avatar_url', '')
  );
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.owns_event(_event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events WHERE id = _event_id AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'))
  )
$$;

-- 4. TRIGGER: Auto-create profile on signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 5. VIEWS

CREATE OR REPLACE VIEW public.v_pickup_point_counts WITH (security_invoker = on) AS
SELECT
  pp.id AS pickup_point_id,
  pp.event_id,
  pp.name AS pickup_name,
  pp.pickup_time,
  COUNT(ata.attendee_id) AS assigned_count
FROM public.transport_pickup_points pp
LEFT JOIN public.attendee_transport_assignments ata ON ata.pickup_point_id = pp.id
GROUP BY pp.id, pp.event_id, pp.name, pp.pickup_time;

CREATE OR REPLACE VIEW public.v_transport_overview WITH (security_invoker = on) AS
SELECT
  ts.event_id,
  ts.enabled,
  ts.mode,
  ts.meetup_time,
  (SELECT COUNT(*) FROM public.attendees a WHERE a.event_id = ts.event_id) AS total_attendees,
  (SELECT COUNT(*) FROM public.attendee_transport_assignments ata WHERE ata.event_id = ts.event_id) AS assigned_count,
  (SELECT COUNT(*) FROM public.attendees a WHERE a.event_id = ts.event_id) -
  (SELECT COUNT(*) FROM public.attendee_transport_assignments ata WHERE ata.event_id = ts.event_id) AS unassigned_count
FROM public.transport_settings ts;

-- 6. RLS POLICIES
-- Enable RLS on all tables
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agenda_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.announcements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.organizers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.dress_codes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.communications_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rsvp_tokens ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_attendees ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.event_speakers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.surveys ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_responses ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.survey_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transport_pickup_points ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendee_transport_assignments ENABLE ROW LEVEL SECURITY;

-- Clients
CREATE POLICY "Owners can manage own clients" ON public.clients FOR ALL USING (auth.uid() = created_by) WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Admins can manage all clients" ON public.clients FOR ALL USING (has_role(auth.uid(), 'admin')) WITH CHECK (has_role(auth.uid(), 'admin'));

-- Events
CREATE POLICY "Anyone can view published events" ON public.events FOR SELECT USING (status = 'published' OR status = 'ongoing' OR auth.uid() = created_by OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Auth users can insert events" ON public.events FOR INSERT WITH CHECK (auth.uid() = created_by);
CREATE POLICY "Owners and admins can update events" ON public.events FOR UPDATE USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);
CREATE POLICY "Owners and admins can delete events" ON public.events FOR DELETE USING (has_role(auth.uid(), 'admin') OR auth.uid() = created_by);

-- Profiles
CREATE POLICY "Users can view all profiles" ON public.profiles FOR SELECT USING (true);
CREATE POLICY "Users can insert own profile" ON public.profiles FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own profile" ON public.profiles FOR UPDATE USING (auth.uid() = user_id);

-- User roles
CREATE POLICY "Users can view own roles" ON public.user_roles FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'admin'));

-- Attendees
CREATE POLICY "Event owners can manage attendees" ON public.attendees FOR ALL
  USING (EXISTS (SELECT 1 FROM events e WHERE e.id = attendees.event_id AND (e.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))))
  WITH CHECK (EXISTS (SELECT 1 FROM events e WHERE e.id = attendees.event_id AND (e.created_by = auth.uid() OR has_role(auth.uid(), 'admin'))));

-- Speakers
CREATE POLICY "Anyone can view speakers" ON public.speakers FOR SELECT USING (true);
CREATE POLICY "Event owners can manage speakers" ON public.speakers FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Agenda items
CREATE POLICY "Anyone can view agenda_items" ON public.agenda_items FOR SELECT USING (true);
CREATE POLICY "Event owners can manage agenda_items" ON public.agenda_items FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Announcements
CREATE POLICY "Anyone can view announcements" ON public.announcements FOR SELECT USING (true);
CREATE POLICY "Event owners can manage announcements" ON public.announcements FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Groups
CREATE POLICY "Event owners can manage groups" ON public.groups FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Attendee groups
CREATE POLICY "Event owners can manage attendee_groups" ON public.attendee_groups FOR ALL
  USING (EXISTS (SELECT 1 FROM attendees a WHERE a.id = attendee_groups.attendee_id AND owns_event(a.event_id)))
  WITH CHECK (EXISTS (SELECT 1 FROM attendees a WHERE a.id = attendee_groups.attendee_id AND owns_event(a.event_id)));

-- Organizers
CREATE POLICY "Anyone can view organizers" ON public.organizers FOR SELECT USING (true);
CREATE POLICY "Event owners can manage organizers" ON public.organizers FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Dress codes
CREATE POLICY "Users can view dress codes for their events" ON public.dress_codes FOR SELECT USING (owns_event(event_id));
CREATE POLICY "Public can view dress codes of published events" ON public.dress_codes FOR SELECT USING (EXISTS (SELECT 1 FROM events e WHERE e.id = dress_codes.event_id AND e.status IN ('published', 'ongoing')));
CREATE POLICY "Users can insert dress codes for their events" ON public.dress_codes FOR INSERT WITH CHECK (owns_event(event_id));
CREATE POLICY "Users can update dress codes for their events" ON public.dress_codes FOR UPDATE USING (owns_event(event_id));
CREATE POLICY "Users can delete dress codes for their events" ON public.dress_codes FOR DELETE USING (owns_event(event_id));

-- Communications log
CREATE POLICY "Event owners can manage communications_log" ON public.communications_log FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- RSVP tokens
CREATE POLICY "Event owners can manage rsvp_tokens" ON public.rsvp_tokens FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Event attendees
CREATE POLICY "Users can view own registrations" ON public.event_attendees FOR SELECT USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can register" ON public.event_attendees FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Admins can manage attendees" ON public.event_attendees FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Users can cancel own registration" ON public.event_attendees FOR DELETE USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'));

-- Event sessions
CREATE POLICY "Anyone can view sessions" ON public.event_sessions FOR SELECT USING (true);
CREATE POLICY "Admins can insert sessions" ON public.event_sessions FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update sessions" ON public.event_sessions FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete sessions" ON public.event_sessions FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Event speakers
CREATE POLICY "Anyone can view speakers" ON public.event_speakers FOR SELECT USING (true);
CREATE POLICY "Admins can insert speakers" ON public.event_speakers FOR INSERT WITH CHECK (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can update speakers" ON public.event_speakers FOR UPDATE USING (has_role(auth.uid(), 'admin'));
CREATE POLICY "Admins can delete speakers" ON public.event_speakers FOR DELETE USING (has_role(auth.uid(), 'admin'));

-- Surveys
CREATE POLICY "Anyone can view published surveys" ON public.surveys FOR SELECT USING (status = 'published');
CREATE POLICY "Event owners can manage surveys" ON public.surveys FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Survey questions
CREATE POLICY "Anyone can view survey_questions" ON public.survey_questions FOR SELECT USING (true);
CREATE POLICY "Event owners can manage survey_questions" ON public.survey_questions FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- Survey responses
CREATE POLICY "Anyone can insert responses for published surveys" ON public.survey_responses FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM surveys s WHERE s.id = survey_responses.survey_id AND s.status = 'published'));
CREATE POLICY "Event owners can view responses" ON public.survey_responses FOR SELECT USING (owns_event(event_id));

-- Survey answers
CREATE POLICY "Anyone can insert answers" ON public.survey_answers FOR INSERT WITH CHECK (EXISTS (SELECT 1 FROM survey_responses r WHERE r.id = survey_answers.response_id));
CREATE POLICY "Event owners can view answers" ON public.survey_answers FOR SELECT USING (owns_event(event_id));

-- Transport settings
CREATE POLICY "Event owners can manage transport_settings" ON public.transport_settings FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Public can view transport_settings of published events" ON public.transport_settings FOR SELECT USING (EXISTS (SELECT 1 FROM events e WHERE e.id = transport_settings.event_id AND e.status IN ('published', 'ongoing')));

-- Transport routes
CREATE POLICY "Event owners can manage transport_routes" ON public.transport_routes FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Public can view transport_routes of published events" ON public.transport_routes FOR SELECT USING (EXISTS (SELECT 1 FROM events e WHERE e.id = transport_routes.event_id AND e.status IN ('published', 'ongoing')));

-- Transport pickup points
CREATE POLICY "Event owners can manage transport_pickup_points" ON public.transport_pickup_points FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));
CREATE POLICY "Public can view transport_pickup_points of published events" ON public.transport_pickup_points FOR SELECT USING (EXISTS (SELECT 1 FROM events e WHERE e.id = transport_pickup_points.event_id AND e.status IN ('published', 'ongoing')));

-- Attendee transport assignments
CREATE POLICY "Event owners can manage attendee_transport_assignments" ON public.attendee_transport_assignments FOR ALL USING (owns_event(event_id)) WITH CHECK (owns_event(event_id));

-- 7. STORAGE BUCKETS (create these in Supabase Dashboard → Storage)
-- Bucket: event-assets (public)
-- Bucket: dress-code-images (public)
