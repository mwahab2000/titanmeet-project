/**
 * Subdomain-based client routing utilities.
 *
 * Production pattern:  clientslug.titanmeet.com/event-slug
 * Dev fallback:        localhost:8080/clientSlug/eventSlug
 *
 * The root domain is configured via VITE_PUBLIC_ROOT_DOMAIN (default: "titanmeet.com").
 */

const ROOT_DOMAIN = import.meta.env.VITE_PUBLIC_ROOT_DOMAIN || "titanmeet.com";

/** Known subdomains that are NOT client slugs */
const RESERVED_SUBDOMAINS = new Set(["www", "app", "api", "admin", "id-preview--ffe8dead-8bbc-4db4-967b-2fb2a5603bc4"]);

/**
 * Returns true when running in local/dev (localhost, 127.0.0.1, or Lovable preview).
 */
export function isLocalDev(): boolean {
  const h = window.location.hostname;
  return (
    h === "localhost" ||
    h === "127.0.0.1" ||
    h.endsWith(".lovable.app")       // Lovable preview
  );
}

/**
 * Extract the client slug from the current hostname.
 * Returns null when on the root domain or in local dev.
 *
 * Example: "nileexecutive.titanmeet.com" → "nileexecutive"
 */
export function getClientSlugFromHostname(): string | null {
  if (isLocalDev()) return null;

  const hostname = window.location.hostname; // e.g. "nileexecutive.titanmeet.com"
  if (!hostname.endsWith(`.${ROOT_DOMAIN}`)) return null;

  const sub = hostname.slice(0, -(ROOT_DOMAIN.length + 1)); // "nileexecutive"
  if (!sub || RESERVED_SUBDOMAINS.has(sub.toLowerCase())) return null;

  return sub.toLowerCase();
}

/**
 * Build the full public URL for an event.
 *
 * Production → https://clientslug.titanmeet.com/event-slug
 * Dev        → /clientSlug/eventSlug  (relative path)
 */
export function buildPublicEventUrl(clientSlug: string, eventSlug: string): string {
  if (isLocalDev()) {
    return `/${clientSlug}/${eventSlug}`;
  }
  const protocol = window.location.protocol; // "https:"
  return `${protocol}//${clientSlug}.${ROOT_DOMAIN}/${eventSlug}`;
}

/**
 * Build the full absolute public URL (always absolute, for emails / external links).
 */
export function buildPublicEventUrlAbsolute(clientSlug: string, eventSlug: string): string {
  return `https://${clientSlug}.${ROOT_DOMAIN}/${eventSlug}`;
}

export { ROOT_DOMAIN };
