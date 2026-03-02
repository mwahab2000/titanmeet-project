
-- Create a public storage bucket for email assets
INSERT INTO storage.buckets (id, name, public)
VALUES ('email-assets', 'email-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Allow public read access to email-assets bucket
CREATE POLICY "Public read access for email-assets"
ON storage.objects FOR SELECT
USING (bucket_id = 'email-assets');
