
CREATE OR REPLACE FUNCTION public.get_user_usage(p_user_id uuid)
 RETURNS json
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $$
DECLARE
  v_clients INTEGER;
  v_events INTEGER;
  v_attendees INTEGER;
  v_emails INTEGER;
  v_storage BIGINT;
  v_cycle_start TIMESTAMPTZ;
BEGIN
  -- Get billing cycle start from account_subscriptions
  SELECT COALESCE(
    (SELECT current_period_start 
     FROM account_subscriptions
     WHERE user_id = p_user_id
     AND status = 'active'
     ORDER BY created_at DESC LIMIT 1),
    date_trunc('month', NOW())
  ) INTO v_cycle_start;

  -- Count clients owned by this user
  SELECT COUNT(*) INTO v_clients
  FROM clients
  WHERE created_by = p_user_id;

  -- Count active events owned by this user
  SELECT COUNT(*) INTO v_events
  FROM events
  WHERE created_by = p_user_id
  AND status IN ('draft', 'published', 'ongoing');

  -- Count attendees this billing cycle across user's events
  SELECT COUNT(*) INTO v_attendees
  FROM attendees a
  JOIN events e ON e.id = a.event_id
  WHERE e.created_by = p_user_id
  AND a.confirmed_at >= v_cycle_start;

  -- Count emails this billing cycle
  SELECT COUNT(*) INTO v_emails
  FROM communications_log cl
  JOIN events e ON e.id = cl.event_id
  WHERE e.created_by = p_user_id
  AND cl.channel = 'email'
  AND cl.created_at >= v_cycle_start;

  -- Sum storage across user's clients
  SELECT COALESCE(SUM(file_size_bytes), 0) INTO v_storage
  FROM storage_usage
  WHERE client_id IN (
    SELECT id FROM clients WHERE created_by = p_user_id
  );

  RETURN json_build_object(
    'clients', v_clients,
    'activeEvents', v_events,
    'attendees', v_attendees,
    'emails', v_emails,
    'storageBytes', v_storage,
    'cycleStart', v_cycle_start
  );
END;
$$;
