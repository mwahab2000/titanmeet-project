
-- event_templates table
CREATE TABLE public.event_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  template_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  included_sections jsonb NOT NULL DEFAULT '["website","agenda","speakers","organizers"]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_event_templates_user_id ON public.event_templates(user_id);

-- RLS
ALTER TABLE public.event_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own templates"
  ON public.event_templates FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins can view all templates"
  ON public.event_templates FOR SELECT
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role));

-- updated_at trigger
CREATE TRIGGER set_event_templates_updated_at
  BEFORE UPDATE ON public.event_templates
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- Grant access
GRANT ALL ON public.event_templates TO authenticated;
GRANT SELECT ON public.event_templates TO anon;
