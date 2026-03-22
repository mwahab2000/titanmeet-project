ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS venue_lat double precision,
  ADD COLUMN IF NOT EXISTS venue_lng double precision,
  ADD COLUMN IF NOT EXISTS venue_place_id text,
  ADD COLUMN IF NOT EXISTS venue_photo_refs jsonb DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.events.venue_lat IS 'Venue latitude from Google Places';
COMMENT ON COLUMN public.events.venue_lng IS 'Venue longitude from Google Places';
COMMENT ON COLUMN public.events.venue_place_id IS 'Google Places place_id';
COMMENT ON COLUMN public.events.venue_photo_refs IS 'Array of selected Google Places photo references with attribution';