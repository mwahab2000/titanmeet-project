import { supabase, edgeFunctionUrl } from "@/integrations/supabase/client";

/**
 * Extract the relative storage path from a stored value.
 * Handles both full public URLs (legacy) and relative paths (new).
 * Returns null if the value is not a storage URL (e.g., external avatar URL).
 */
export function extractStoragePath(bucket: string, storedValue: string): string | null {
  if (!storedValue) return null;

  // Already a relative path (no http)
  if (!storedValue.startsWith("http")) return storedValue;

  // Full Supabase storage public URL
  const publicPrefix = `/storage/v1/object/public/${bucket}/`;
  const idx = storedValue.indexOf(publicPrefix);
  if (idx !== -1) {
    return storedValue.substring(idx + publicPrefix.length).split("?")[0];
  }

  // Full Supabase signed URL
  const signedPrefix = `/storage/v1/object/sign/${bucket}/`;
  const sIdx = storedValue.indexOf(signedPrefix);
  if (sIdx !== -1) {
    return storedValue.substring(sIdx + signedPrefix.length).split("?")[0];
  }

  // Not a storage URL (e.g., dicebear avatar)
  return null;
}

/**
 * Build the edge function proxy URL for public/anonymous access.
 * Used on public event pages for published events.
 */
export function getPublicAssetUrl(bucket: string, storedValue: string): string {
  const path = extractStoragePath(bucket, storedValue);
  if (!path) return storedValue; // External URL, return as-is
  return edgeFunctionUrl(`serve-event-asset/${bucket}/${path}`);
}

/**
 * Create a signed URL for authenticated workspace access.
 * Requires the user to have SELECT access via storage RLS.
 */
export async function createSignedAssetUrl(
  bucket: string,
  storedValue: string,
  expiresIn = 3600,
): Promise<string> {
  const path = extractStoragePath(bucket, storedValue);
  if (!path) return storedValue; // External URL

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, expiresIn);

  if (error || !data?.signedUrl) {
    console.warn("Failed to create signed URL:", error?.message);
    return "";
  }
  return data.signedUrl;
}

/**
 * Batch create signed URLs for an array of stored values.
 */
export async function createSignedAssetUrls(
  bucket: string,
  storedValues: string[],
  expiresIn = 3600,
): Promise<string[]> {
  if (!storedValues.length) return [];

  const results: string[] = new Array(storedValues.length).fill("");
  const toSign: { index: number; path: string }[] = [];

  storedValues.forEach((val, i) => {
    const path = extractStoragePath(bucket, val);
    if (path) {
      toSign.push({ index: i, path });
    } else {
      results[i] = val; // External URL, use as-is
    }
  });

  if (toSign.length > 0) {
    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrls(
        toSign.map((s) => s.path),
        expiresIn,
      );

    if (!error && data) {
      data.forEach((d, i) => {
        results[toSign[i].index] = d.signedUrl || "";
      });
    }
  }

  return results;
}
