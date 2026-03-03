
-- 1. Helper: check if current user owns the client referenced by the storage path
--    Path convention: {client_slug}/{filename}
CREATE OR REPLACE FUNCTION public.storage_owns_client_asset(object_name text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  parts text[];
  client_slug text;
BEGIN
  parts := string_to_array(object_name, '/');
  IF array_length(parts, 1) < 1 THEN RETURN false; END IF;
  client_slug := parts[1];
  RETURN EXISTS (
    SELECT 1 FROM public.clients
    WHERE slug = client_slug
      AND (created_by = auth.uid() OR has_role(auth.uid(), 'admin'::app_role))
  );
END;
$$;

-- 2. Drop overly broad policies
DROP POLICY IF EXISTS "client_assets_insert" ON storage.objects;
DROP POLICY IF EXISTS "client_assets_delete" ON storage.objects;

-- 3. Owner-only INSERT
CREATE POLICY "client_assets_insert" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'client-assets'
  AND storage_owns_client_asset(name)
);

-- 4. Owner-only UPDATE
CREATE POLICY "client_assets_update" ON storage.objects
FOR UPDATE TO authenticated
USING (
  bucket_id = 'client-assets'
  AND storage_owns_client_asset(name)
);

-- 5. Owner-only DELETE
CREATE POLICY "client_assets_delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'client-assets'
  AND storage_owns_client_asset(name)
);

-- 6. SELECT stays public (already exists, no change needed)
