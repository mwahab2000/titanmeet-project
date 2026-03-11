
-- Server-side function to safely delete draft events only
CREATE OR REPLACE FUNCTION public.delete_draft_event(_event_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  _status text;
  _owner uuid;
BEGIN
  -- Get event status and owner
  SELECT status::text, created_by INTO _status, _owner
  FROM public.events
  WHERE id = _event_id;

  IF _status IS NULL THEN
    RAISE EXCEPTION 'Event not found' USING ERRCODE = 'P0002';
  END IF;

  -- Only the owner or admin can delete
  IF _owner != auth.uid() AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Not authorized to delete this event' USING ERRCODE = '42501';
  END IF;

  -- Block deletion of non-draft events
  IF _status != 'draft' THEN
    RAISE EXCEPTION 'Only draft events can be deleted. Current status: %', _status USING ERRCODE = '23514';
  END IF;

  -- Delete related records that may not have CASCADE
  DELETE FROM public.message_logs WHERE event_id = _event_id;
  DELETE FROM public.communications_log WHERE event_id = _event_id;
  DELETE FROM public.survey_answers WHERE event_id = _event_id;
  DELETE FROM public.survey_invites WHERE event_id = _event_id;
  DELETE FROM public.attendee_transport_assignments WHERE event_id = _event_id;
  DELETE FROM public.event_announcements WHERE event_id = _event_id;

  -- Delete the event (CASCADE handles attendees, agenda_items, organizers, speakers, groups, event_invites, announcements, etc.)
  DELETE FROM public.events WHERE id = _event_id;
END;
$$;
