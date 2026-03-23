-- AI User Memory table
CREATE TABLE public.ai_user_memory (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  memory_type text NOT NULL DEFAULT 'preference',
  key text NOT NULL,
  value jsonb NOT NULL DEFAULT '{}',
  confidence_score numeric NOT NULL DEFAULT 0.5,
  usage_count integer NOT NULL DEFAULT 1,
  source text NOT NULL DEFAULT 'inferred',
  is_active boolean NOT NULL DEFAULT true,
  last_used_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Unique constraint: one memory per user per key
ALTER TABLE public.ai_user_memory ADD CONSTRAINT ai_user_memory_user_key_unique UNIQUE (user_id, key);

-- Updated at trigger
CREATE TRIGGER ai_user_memory_updated_at
  BEFORE UPDATE ON public.ai_user_memory
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Enable RLS
ALTER TABLE public.ai_user_memory ENABLE ROW LEVEL SECURITY;

-- Users can manage own memories
CREATE POLICY "Users can manage own memories"
  ON public.ai_user_memory FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Service role full access
CREATE POLICY "Service role full access ai_user_memory"
  ON public.ai_user_memory FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Grants
GRANT SELECT, INSERT, UPDATE, DELETE ON public.ai_user_memory TO authenticated;
GRANT ALL ON public.ai_user_memory TO service_role;