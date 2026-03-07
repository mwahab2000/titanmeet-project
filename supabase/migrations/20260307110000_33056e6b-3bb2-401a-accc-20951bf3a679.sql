
-- Trigger function to prevent slug changes
CREATE OR REPLACE FUNCTION public.prevent_slug_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF OLD.slug IS NOT NULL AND NEW.slug IS DISTINCT FROM OLD.slug THEN
    RAISE EXCEPTION 'Slug cannot be changed after creation' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

-- Apply to clients table
CREATE TRIGGER trg_clients_immutable_slug
  BEFORE UPDATE ON public.clients
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_slug_update();

-- Apply to events table
CREATE TRIGGER trg_events_immutable_slug
  BEFORE UPDATE ON public.events
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_slug_update();
