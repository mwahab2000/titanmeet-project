-- Brand Kits table for reusable visual identity
CREATE TABLE IF NOT EXISTS public.brand_kits (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  name text NOT NULL,
  primary_color text,
  secondary_color text,
  accent_color text,
  logo_url text,
  typography_preference text DEFAULT 'modern',
  visual_mood text[] DEFAULT '{}',
  style_tags jsonb DEFAULT '[]'::jsonb,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_brand_kits_client ON public.brand_kits(client_id);
CREATE INDEX IF NOT EXISTS idx_brand_kits_created_by ON public.brand_kits(created_by);

ALTER TABLE public.brand_kits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own brand kits"
  ON public.brand_kits FOR ALL TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all brand kits"
  ON public.brand_kits FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access brand_kits"
  ON public.brand_kits FOR ALL TO service_role
  USING (true) WITH CHECK (true);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.brand_kits TO authenticated;
GRANT ALL ON public.brand_kits TO service_role;

-- Visual pack and brand kit references on media_assets
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS visual_pack_name text;
ALTER TABLE public.media_assets ADD COLUMN IF NOT EXISTS brand_kit_id uuid REFERENCES public.brand_kits(id) ON DELETE SET NULL;