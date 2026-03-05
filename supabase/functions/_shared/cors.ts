/**
 * Shared CORS helper for TitanMeet edge functions.
 *
 * Restricts Access-Control-Allow-Origin to an explicit allowlist
 * instead of the wildcard "*". Subdomains of titanmeet.com are
 * matched dynamically (e.g. client.titanmeet.com).
 */

const ALLOWED_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:4173",
  "https://titanmeet.com",
  "https://www.titanmeet.com",
];

const SUBDOMAIN_RE = /^https:\/\/[a-z0-9-]+\.titanmeet\.com$/;

// Lovable preview domains
const LOVABLE_RE = /^https:\/\/.*\.lovable\.app$/;

const ALLOWED_HEADERS =
  "authorization, x-client-info, apikey, content-type, x-internal-secret, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version";

function isAllowedOrigin(origin: string | null): string | null {
  if (!origin) return null;
  if (ALLOWED_ORIGINS.includes(origin)) return origin;
  if (SUBDOMAIN_RE.test(origin)) return origin;
  if (LOVABLE_RE.test(origin)) return origin;
  return null;
}

/**
 * Build CORS headers for a browser-facing edge function.
 * Returns headers with the matched origin, or no Allow-Origin header
 * if the origin is not in the allowlist.
 */
export function getCorsHeaders(req: Request): Record<string, string> {
  const origin = req.headers.get("Origin");
  const allowed = isAllowedOrigin(origin);
  const headers: Record<string, string> = {
    "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
    "Access-Control-Allow-Headers": ALLOWED_HEADERS,
  };
  if (allowed) {
    headers["Access-Control-Allow-Origin"] = allowed;
  }
  return headers;
}

/**
 * Handle an OPTIONS preflight request.
 */
export function handleCorsOptions(req: Request): Response {
  return new Response(null, { headers: getCorsHeaders(req) });
}
