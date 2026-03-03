
-- Add unique constraint on (client_id, slug) for events
-- NULLs in client_id are treated as distinct by Postgres, so events without a client
-- won't conflict with each other (acceptable for MVP — clientless events are rare/internal).
CREATE UNIQUE INDEX idx_events_client_slug ON public.events (client_id, slug)
  WHERE client_id IS NOT NULL AND slug IS NOT NULL;
