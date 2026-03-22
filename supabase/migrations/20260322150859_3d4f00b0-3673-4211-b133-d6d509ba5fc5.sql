-- Media assets table
CREATE TABLE IF NOT EXISTS public.media_assets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid,
  client_id uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  event_id uuid REFERENCES public.events(id) ON DELETE CASCADE,
  template_id uuid REFERENCES public.event_templates(id) ON DELETE SET NULL,
  media_type text NOT NULL DEFAULT 'hero_image',
  source_type text NOT NULL DEFAULT 'uploaded',
  title text,
  prompt_used text,
  style_tags jsonb DEFAULT '[]'::jsonb,
  file_url text NOT NULL,
  thumbnail_url text,
  attribution text,
  approved boolean DEFAULT false,
  created_by uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_media_assets_workspace ON public.media_assets(workspace_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_event ON public.media_assets(event_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_client ON public.media_assets(client_id);
CREATE INDEX IF NOT EXISTS idx_media_assets_type ON public.media_assets(media_type);

ALTER TABLE public.media_assets ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage own media assets"
  ON public.media_assets FOR ALL
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Admins can manage all media assets"
  ON public.media_assets FOR ALL
  TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Service role full access media_assets"
  ON public.media_assets FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

INSERT INTO storage.buckets (id, name, public)
VALUES ('media-library', 'media-library', false)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Authenticated users can upload to media-library"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (bucket_id = 'media-library');

CREATE POLICY "Authenticated users can read media-library"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'media-library');

CREATE POLICY "Users can delete own media-library files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'media-library' AND (auth.uid())::text = (storage.foldername(name))[1]);

CREATE POLICY "Service role full access media-library"
  ON storage.objects FOR ALL
  TO service_role
  USING (bucket_id = 'media-library')
  WITH CHECK (bucket_id = 'media-library');

GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.media_assets TO service_role;