import { useState, useEffect, useRef } from "react";
import { createSignedAssetUrl, createSignedAssetUrls } from "@/lib/storage";

/**
 * Hook to get a signed URL for a single storage path.
 * Handles external URLs (e.g., dicebear) by returning them as-is.
 */
export function useSignedUrl(
  bucket: string,
  storedValue: string | null | undefined,
): string {
  const [url, setUrl] = useState("");

  useEffect(() => {
    if (!storedValue) {
      setUrl("");
      return;
    }
    let cancelled = false;
    createSignedAssetUrl(bucket, storedValue).then((signed) => {
      if (!cancelled) setUrl(signed);
    });
    return () => { cancelled = true; };
  }, [bucket, storedValue]);

  return url;
}

/**
 * Hook to get signed URLs for an array of storage paths.
 */
export function useSignedUrls(
  bucket: string,
  storedValues: string[],
): string[] {
  const [urls, setUrls] = useState<string[]>([]);
  const prevKey = useRef("");

  useEffect(() => {
    const key = storedValues.join("|");
    if (key === prevKey.current) return;
    prevKey.current = key;

    if (!storedValues.length) {
      setUrls([]);
      return;
    }

    let cancelled = false;
    createSignedAssetUrls(bucket, storedValues).then((signed) => {
      if (!cancelled) setUrls(signed);
    });
    return () => { cancelled = true; };
  }, [bucket, storedValues]);

  return urls;
}
