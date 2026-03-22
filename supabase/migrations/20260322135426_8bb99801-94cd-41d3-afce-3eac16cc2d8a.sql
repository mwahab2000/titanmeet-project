-- 1. AI Action Logs table for observability
CREATE TABLE IF NOT EXISTS public.ai_action_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  action_name text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  message text,
  category text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ai_action_logs_session ON public.ai_action_logs(session_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_user ON public.ai_action_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_ai_action_logs_created ON public.ai_action_logs(created_at DESC);

ALTER TABLE public.ai_action_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role full access ai_action_logs"
  ON public.ai_action_logs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "Users can view own ai_action_logs"
  ON public.ai_action_logs FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

-- 2. Add readiness columns to events
ALTER TABLE public.events
  ADD COLUMN IF NOT EXISTS readiness boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS readiness_details jsonb DEFAULT '{}'::jsonb;

-- 3. Grant permissions
GRANT SELECT, INSERT ON public.ai_action_logs TO service_role;
GRANT SELECT ON public.ai_action_logs TO authenticated;