
-- Notification type enum
CREATE TYPE public.notification_type AS ENUM (
  'support_reply',
  'support_status_changed',
  'payment_confirmed',
  'payment_failed',
  'payment_expired',
  'subscription_upgraded',
  'usage_warning',
  'event_published',
  'invitation_sent',
  'invitation_failed'
);

-- Notifications table
CREATE TABLE public.notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.notification_type NOT NULL,
  title text NOT NULL,
  message text NOT NULL,
  link text,
  metadata jsonb DEFAULT '{}'::jsonb,
  read boolean NOT NULL DEFAULT false,
  read_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_notifications_user_unread ON public.notifications (user_id, read, created_at DESC);
CREATE INDEX idx_notifications_user_created ON public.notifications (user_id, created_at DESC);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Users can view own notifications
CREATE POLICY "Users can view own notifications"
  ON public.notifications FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- Users can update own notifications (mark read)
CREATE POLICY "Users can update own notifications"
  ON public.notifications FOR UPDATE TO authenticated
  USING (auth.uid() = user_id);

-- Service role inserts (no INSERT policy for authenticated — notifications created server-side or via triggers)
-- We add an admin insert policy for edge functions using service role (bypasses RLS anyway)
-- And a self-insert for frontend-triggered notifications
CREATE POLICY "Users can insert own notifications"
  ON public.notifications FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Grant access
GRANT ALL ON public.notifications TO authenticated;
GRANT ALL ON public.notifications TO anon;

-- DB function to create a notification (used by triggers / edge functions)
CREATE OR REPLACE FUNCTION public.create_notification(
  _user_id uuid,
  _type public.notification_type,
  _title text,
  _message text,
  _link text DEFAULT NULL,
  _metadata jsonb DEFAULT '{}'::jsonb
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _id uuid;
BEGIN
  INSERT INTO public.notifications (user_id, type, title, message, link, metadata)
  VALUES (_user_id, _type, _title, _message, _link, _metadata)
  RETURNING id INTO _id;
  RETURN _id;
END;
$$;

-- Trigger: notify ticket owner when a support reply is added by admin/support
CREATE OR REPLACE FUNCTION public.notify_on_support_reply()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _ticket RECORD;
BEGIN
  -- Only notify if reply is from admin/support (not from ticket owner)
  IF NEW.author_role IN ('admin', 'support') THEN
    SELECT id, user_id, subject INTO _ticket
    FROM public.support_tickets WHERE id = NEW.ticket_id;

    IF _ticket.user_id IS NOT NULL AND _ticket.user_id != NEW.user_id THEN
      PERFORM public.create_notification(
        _ticket.user_id,
        'support_reply',
        'New reply on your ticket',
        'Support replied to: ' || _ticket.subject,
        '/dashboard/support/' || _ticket.id::text,
        jsonb_build_object('ticket_id', _ticket.id)
      );
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_support_reply
  AFTER INSERT ON public.support_ticket_messages
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_support_reply();

-- Trigger: notify ticket owner when ticket status changes
CREATE OR REPLACE FUNCTION public.notify_on_ticket_status_change()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  _status_label text;
BEGIN
  IF OLD.status IS DISTINCT FROM NEW.status THEN
    _status_label := CASE NEW.status
      WHEN 'resolved' THEN 'resolved'
      WHEN 'closed' THEN 'closed'
      WHEN 'open' THEN 'reopened'
      WHEN 'pending_admin' THEN 'awaiting your reply'
      ELSE NEW.status::text
    END;

    PERFORM public.create_notification(
      NEW.user_id,
      'support_status_changed',
      'Ticket status updated',
      'Your ticket "' || NEW.subject || '" is now ' || _status_label || '.',
      '/dashboard/support/' || NEW.id::text,
      jsonb_build_object('ticket_id', NEW.id, 'new_status', NEW.status::text)
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_notify_ticket_status
  AFTER UPDATE ON public.support_tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.notify_on_ticket_status_change();
