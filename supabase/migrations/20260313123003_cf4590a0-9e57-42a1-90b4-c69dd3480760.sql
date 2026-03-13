
-- ============================================================
-- Voice Studio Tables
-- ============================================================

-- 1) voice_sessions
CREATE TABLE public.voice_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL DEFAULT auth.uid(),
  event_id uuid NULL REFERENCES public.events(id) ON DELETE SET NULL,
  draft_key text NULL,
  status text NOT NULL DEFAULT 'paused',
  language_mode text NOT NULL DEFAULT 'auto',
  transcript jsonb NOT NULL DEFAULT '[]'::jsonb,
  pending_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  confirmed_actions jsonb NOT NULL DEFAULT '[]'::jsonb,
  context jsonb NOT NULL DEFAULT '{}'::jsonb,
  last_heard_at timestamptz NULL,
  paused_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_voice_sessions_user_event ON public.voice_sessions (user_id, event_id);
CREATE INDEX idx_voice_sessions_user_draft ON public.voice_sessions (user_id, draft_key);

-- 2) voice_action_log
CREATE TABLE public.voice_action_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  voice_session_id uuid NOT NULL REFERENCES public.voice_sessions(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  event_id uuid NULL,
  action jsonb NOT NULL,
  status text NOT NULL,
  error text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3) voice_usage
CREATE TABLE public.voice_usage (
  user_id uuid NOT NULL,
  usage_date date NOT NULL,
  transcribe_count int NOT NULL DEFAULT 0,
  parse_count int NOT NULL DEFAULT 0,
  PRIMARY KEY (user_id, usage_date)
);

-- ============================================================
-- RLS
-- ============================================================

ALTER TABLE public.voice_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_action_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.voice_usage ENABLE ROW LEVEL SECURITY;

-- voice_sessions
CREATE POLICY "Users can select own voice sessions"
  ON public.voice_sessions FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own voice sessions"
  ON public.voice_sessions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own voice sessions"
  ON public.voice_sessions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- voice_action_log
CREATE POLICY "Users can select own voice action log"
  ON public.voice_action_log FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own voice action log"
  ON public.voice_action_log FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own voice action log"
  ON public.voice_action_log FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- voice_usage
CREATE POLICY "Users can select own voice usage"
  ON public.voice_usage FOR SELECT TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own voice usage"
  ON public.voice_usage FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own voice usage"
  ON public.voice_usage FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

-- ============================================================
-- Grants for service_role (edge functions)
-- ============================================================
GRANT SELECT, INSERT, UPDATE ON public.voice_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.voice_action_log TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE ON public.voice_usage TO authenticated, service_role;
GRANT SELECT ON public.voice_sessions TO anon;
