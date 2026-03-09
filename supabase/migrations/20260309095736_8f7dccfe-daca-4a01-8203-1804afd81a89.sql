
-- Email queue for onboarding drip sequence
CREATE TABLE public.email_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  email text NOT NULL,
  first_name text,
  template_id text NOT NULL,
  send_at timestamp with time zone NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'pending',
  sent_at timestamp with time zone,
  error text,
  created_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Index for the cron processor query
CREATE INDEX idx_email_queue_pending ON public.email_queue (status, send_at) WHERE status = 'pending';

-- RLS
ALTER TABLE public.email_queue ENABLE ROW LEVEL SECURITY;

-- Only admins/owners can view
CREATE POLICY "Admins can view email_queue"
  ON public.email_queue FOR SELECT
  USING (public.is_admin() OR public.is_owner());
