-- Add marketplace fields to event_templates
ALTER TABLE public.event_templates
  ADD COLUMN IF NOT EXISTS category text NOT NULL DEFAULT 'general',
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS is_featured boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS preview_image text,
  ADD COLUMN IF NOT EXISTS comm_templates jsonb NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS event_type text DEFAULT 'other',
  ADD COLUMN IF NOT EXISTS expected_attendees integer;

-- Allow admins to manage all templates (not just view)
DROP POLICY IF EXISTS "Admins can view all templates" ON public.event_templates;
CREATE POLICY "Admins can manage all templates"
  ON public.event_templates FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Index for marketplace browsing
CREATE INDEX IF NOT EXISTS idx_event_templates_category ON public.event_templates(category);
CREATE INDEX IF NOT EXISTS idx_event_templates_featured ON public.event_templates(is_featured) WHERE is_featured = true;