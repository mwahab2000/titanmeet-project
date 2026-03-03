CREATE OR REPLACE FUNCTION public.storage_extract_event_id(bucket_name text, object_name text)
 RETURNS uuid
 LANGUAGE plpgsql
 IMMUTABLE SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  parts text[];
  candidate text;
BEGIN
  parts := string_to_array(object_name, '/');

  IF bucket_name = 'event-assets' THEN
    IF array_length(parts, 1) >= 2 THEN
      candidate := parts[2];
    END IF;
  ELSIF bucket_name = 'dress-code-images' THEN
    IF array_length(parts, 1) >= 1 THEN
      candidate := parts[1];
    END IF;
  END IF;

  IF candidate IS NULL THEN RETURN NULL; END IF;
  RETURN candidate::uuid;
EXCEPTION WHEN OTHERS THEN
  RETURN NULL;
END;
$function$;