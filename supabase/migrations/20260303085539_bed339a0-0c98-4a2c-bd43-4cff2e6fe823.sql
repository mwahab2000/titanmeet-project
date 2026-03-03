
-- ============================================================
-- STORAGE HARDENING: Private buckets + event-aware RLS
-- ============================================================

-- 1. Create PRIVATE buckets (or make existing ones private)
INSERT INTO storage.buckets (id, name, public)
VALUES ('event-assets', 'event-assets', false)
ON CONFLICT (id) DO UPDATE SET public = false;

INSERT INTO storage.buckets (id, name, public)
VALUES ('dress-code-images', 'dress-code-images', false)
ON CONFLICT (id) DO UPDATE SET public = false;

-- Separate public bucket for client logos (no event ownership)
INSERT INTO storage.buckets (id, name, public)
VALUES ('client-assets', 'client-assets', true)
ON CONFLICT (id) DO NOTHING;

-- 2. Helper: extract event_id UUID from storage object path
-- event-assets paths:       events/{event_id}/..., speakers/{event_id}/...
-- dress-code-images paths:  {event_id}/...
CREATE OR REPLACE FUNCTION public.storage_extract_event_id(
  bucket_name text,
  object_name text
)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SECURITY DEFINER
SET search_path = 'public'
AS $$
DECLARE
  parts text[];
  candidate text;
BEGIN
  parts := string_to_array(object_name, '/');

  IF bucket_name = 'event-assets' THEN
    -- Pattern: {category}/{event_id}/...  (e.g. events/UUID/hero/file.jpg)
    IF array_length(parts, 1) >= 2 THEN
      candidate := parts[2];
    END IF;
  ELSIF bucket_name = 'dress-code-images' THEN
    -- Pattern: {event_id}/...
    IF array_length(parts, 1) >= 1 THEN
      candidate := parts[1];
    END IF;
  END IF;

  IF candidate IS NULL THEN RETURN NULL; END IF;
  RETURN candidate::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$$;

-- 3. Drop ALL existing storage policies for these buckets
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT policyname FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND (
      policyname ILIKE '%event%asset%'
      OR policyname ILIKE '%dress%code%'
      OR policyname ILIKE '%client%asset%'
    )
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON storage.objects', pol.policyname);
  END LOOP;
END;
$$;

-- 4. SELECT policies (read access)
-- Event assets: owner OR published event
CREATE POLICY "event_assets_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'event-assets'
    AND (
      is_event_public(storage_extract_event_id(bucket_id, name))
      OR owns_event(storage_extract_event_id(bucket_id, name))
    )
  );

-- Dress code images: owner OR published event
CREATE POLICY "dress_code_images_select"
  ON storage.objects FOR SELECT
  USING (
    bucket_id = 'dress-code-images'
    AND (
      is_event_public(storage_extract_event_id(bucket_id, name))
      OR owns_event(storage_extract_event_id(bucket_id, name))
    )
  );

-- Client assets: public bucket, anyone can view
CREATE POLICY "client_assets_select"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'client-assets');

-- 5. INSERT policies (upload - owner only)
CREATE POLICY "event_assets_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'event-assets'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

CREATE POLICY "dress_code_images_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'dress-code-images'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

CREATE POLICY "client_assets_insert"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'client-assets'
    AND auth.role() = 'authenticated'
  );

-- 6. UPDATE policies (owner only)
CREATE POLICY "event_assets_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'event-assets'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

CREATE POLICY "dress_code_images_update"
  ON storage.objects FOR UPDATE
  USING (
    bucket_id = 'dress-code-images'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

-- 7. DELETE policies (owner only)
CREATE POLICY "event_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'event-assets'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

CREATE POLICY "dress_code_images_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'dress-code-images'
    AND owns_event(storage_extract_event_id(bucket_id, name))
  );

CREATE POLICY "client_assets_delete"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'client-assets'
    AND auth.role() = 'authenticated'
  );
