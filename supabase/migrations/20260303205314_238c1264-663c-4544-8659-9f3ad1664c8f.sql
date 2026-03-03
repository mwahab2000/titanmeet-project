
-- Enable pg_net for HTTP calls from DB triggers
CREATE EXTENSION IF NOT EXISTS pg_net WITH SCHEMA extensions;

-- Function to send notification emails via edge function
CREATE OR REPLACE FUNCTION public.send_notification_email()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _payload jsonb;
  _supabase_url text;
  _service_key text;
BEGIN
  _payload := TG_ARGV[0]::jsonb;
  
  -- Get config from vault/env — use current_setting for service URL
  _supabase_url := current_setting('app.settings.supabase_url', true);
  _service_key := current_setting('app.settings.service_role_key', true);

  -- If settings not available, try direct env approach
  IF _supabase_url IS NULL OR _supabase_url = '' THEN
    RETURN NEW;
  END IF;

  PERFORM extensions.http_post(
    url := _supabase_url || '/functions/v1/send-notification-email',
    body := _payload::text,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'x-internal-secret', _service_key
    )
  );

  RETURN NEW;
END;
$$;

-- Replace existing support reply trigger to also send email
CREATE OR REPLACE FUNCTION public.notify_on_support_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _ticket RECORD;
  _supabase_url text;
  _anon_key text;
BEGIN
  IF NEW.author_role IN ('admin', 'support') THEN
    SELECT id, user_id, subject INTO _ticket
    FROM public.support_tickets WHERE id = NEW.ticket_id;

    IF _ticket.user_id IS NOT NULL AND _ticket.user_id != NEW.user_id THEN
      -- In-app notification (existing)
      PERFORM public.create_notification(
        _ticket.user_id,
        'support_reply',
        'New reply on your ticket',
        'Support replied to: ' || _ticket.subject,
        '/dashboard/support/' || _ticket.id::text,
        jsonb_build_object('ticket_id', _ticket.id)
      );

      -- Email notification via pg_net
      BEGIN
        SELECT decrypted_secret INTO _supabase_url
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
        SELECT decrypted_secret INTO _anon_key
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

        IF _supabase_url IS NOT NULL AND _anon_key IS NOT NULL THEN
          PERFORM net.http_post(
            url := _supabase_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-internal-secret', _anon_key
            ),
            body := jsonb_build_object(
              'type', 'support_reply',
              'user_id', _ticket.user_id::text,
              'title', 'New reply on your ticket',
              'message', 'Support replied to your ticket: ' || _ticket.subject,
              'link', '/dashboard/support/' || _ticket.id::text,
              'metadata', jsonb_build_object('ticket_id', _ticket.id, 'message_id', NEW.id)
            )
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email notification failed: %', SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- Replace existing ticket status trigger to also send email
CREATE OR REPLACE FUNCTION public.notify_on_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'extensions'
AS $$
DECLARE
  _status_label text;
  _supabase_url text;
  _anon_key text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _status_label := CASE NEW.status
      WHEN 'resolved' THEN 'resolved'
      WHEN 'closed' THEN 'closed'
      WHEN 'open' THEN 'reopened'
      WHEN 'pending_admin' THEN 'awaiting your reply'
      ELSE NEW.status::text
    END;

    -- In-app notification (existing)
    PERFORM public.create_notification(
      NEW.user_id,
      'support_status_changed',
      'Ticket status updated',
      'Your ticket "' || NEW.subject || '" is now ' || _status_label || '.',
      '/dashboard/support/' || NEW.id::text,
      jsonb_build_object('ticket_id', NEW.id, 'new_status', NEW.status::text)
    );

    -- Email notification via pg_net (only for important statuses)
    IF NEW.status IN ('resolved', 'open', 'closed') THEN
      BEGIN
        SELECT decrypted_secret INTO _supabase_url
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_URL' LIMIT 1;
        SELECT decrypted_secret INTO _anon_key
        FROM vault.decrypted_secrets WHERE name = 'SUPABASE_SERVICE_ROLE_KEY' LIMIT 1;

        IF _supabase_url IS NOT NULL AND _anon_key IS NOT NULL THEN
          PERFORM net.http_post(
            url := _supabase_url || '/functions/v1/send-notification-email',
            headers := jsonb_build_object(
              'Content-Type', 'application/json',
              'x-internal-secret', _anon_key
            ),
            body := jsonb_build_object(
              'type', 'support_status_changed',
              'user_id', NEW.user_id::text,
              'title', 'Ticket status updated',
              'message', 'Your ticket "' || NEW.subject || '" is now ' || _status_label || '.',
              'link', '/dashboard/support/' || NEW.id::text,
              'metadata', jsonb_build_object('ticket_id', NEW.id, 'new_status', NEW.status::text)
            )
          );
        END IF;
      EXCEPTION WHEN OTHERS THEN
        RAISE WARNING 'Email notification failed: %', SQLERRM;
      END;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
