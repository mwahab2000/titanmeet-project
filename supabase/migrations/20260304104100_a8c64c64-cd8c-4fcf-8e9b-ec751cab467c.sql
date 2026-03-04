
-- Create the Q2 Board Meeting event
INSERT INTO public.events (
  title, slug, client_id, status, created_by,
  description, event_date, start_date, end_date,
  venue_name, venue_address, location, venue
) VALUES (
  'Nile Executive Holdings Q2 Board Meeting',
  'q2-board-meeting-2026',
  'dfea8917-19a8-4f7a-87e0-c93d49cb2a59',
  'draft',
  'ba93d198-3c9d-4537-8b97-6f3b6b65cdce',
  'A closed executive board meeting to review Q1 performance, approve the Q2 strategic roadmap, and discuss operational priorities across Egypt and regional markets.',
  '2026-04-21',
  '2026-04-21T09:00:00Z',
  '2026-04-21T14:00:00Z',
  'Four Seasons Hotel Cairo at Nile Plaza',
  '1089 Corniche El Nil, Garden City, Cairo',
  'Cairo, Egypt',
  'Four Seasons Hotel Cairo at Nile Plaza'
);
