-- AI Builder session persistence tables

CREATE TABLE public.ai_chat_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE SET NULL,
  title text,
  status text NOT NULL DEFAULT 'active',
  state_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.ai_chat_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES public.ai_chat_sessions(id) ON DELETE CASCADE,
  role text NOT NULL DEFAULT 'user',
  content text NOT NULL DEFAULT '',
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_ai_chat_sessions_user_id ON public.ai_chat_sessions(user_id);
CREATE INDEX idx_ai_chat_sessions_updated_at ON public.ai_chat_sessions(updated_at DESC);
CREATE INDEX idx_ai_chat_messages_session_id ON public.ai_chat_messages(session_id);
CREATE INDEX idx_ai_chat_messages_created_at ON public.ai_chat_messages(created_at);

CREATE TRIGGER set_ai_chat_sessions_updated_at
  BEFORE UPDATE ON public.ai_chat_sessions
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.ai_chat_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own AI sessions"
  ON public.ai_chat_sessions FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can manage own AI messages"
  ON public.ai_chat_messages FOR ALL
  TO authenticated
  USING (EXISTS (SELECT 1 FROM public.ai_chat_sessions s WHERE s.id = ai_chat_messages.session_id AND s.user_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.ai_chat_sessions s WHERE s.id = ai_chat_messages.session_id AND s.user_id = auth.uid()));

CREATE POLICY "Service role full access sessions"
  ON public.ai_chat_sessions FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Service role full access messages"
  ON public.ai_chat_messages FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_sessions TO authenticated, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_chat_messages TO authenticated, service_role;