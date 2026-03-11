/**
 * Shared phone number normalization for WhatsApp / SMS delivery.
 *
 * Handles common input issues:
 *   - Leading/trailing whitespace
 *   - Spaces, dashes, parentheses, dots within the number
 *   - "00" international prefix → "+"
 *   - Missing "+" prefix
 *   - Leading zero after country code (best-effort)
 *
 * Returns an E.164 string (e.g. "+971501234567") or null if the input
 * cannot be safely normalised. Callers should treat null as "invalid_phone".
 *
 * IMPORTANT: Never log the full phone number in production.
 * Use `maskedPhone()` for safe logging.
 */

/** Strict E.164 regex: + followed by 7-15 digits, first digit non-zero */
const E164_RE = /^\+[1-9]\d{6,14}$/;

/**
 * Attempt to normalise a raw phone string into E.164 format.
 * Returns the normalised string, or `null` if it can't be done safely.
 */
export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null;

  // Step 1 — strip all formatting characters
  let cleaned = raw.trim().replace(/[\s\-().·]/g, "");

  // Step 2 — empty after cleaning
  if (!cleaned) return null;

  // Step 3 — handle "whatsapp:" prefix (strip it, we re-add later)
  if (cleaned.toLowerCase().startsWith("whatsapp:")) {
    cleaned = cleaned.slice(9);
  }

  // Step 4 — "00" international dialling prefix → "+"
  if (cleaned.startsWith("00") && cleaned.length > 4) {
    cleaned = "+" + cleaned.slice(2);
  }

  // Step 5 — ensure leading "+"
  if (!cleaned.startsWith("+")) {
    // If it starts with a valid country-code digit (1-9), add "+"
    if (/^[1-9]/.test(cleaned)) {
      cleaned = "+" + cleaned;
    } else if (cleaned.startsWith("0")) {
      // Local number without country code — we can't safely determine the country
      // Return null to signal "needs manual correction"
      return null;
    } else {
      return null;
    }
  }

  // Step 6 — validate E.164
  if (!E164_RE.test(cleaned)) return null;

  return cleaned;
}

/**
 * Build the full WhatsApp "To" address: `whatsapp:+XXXXXXXXXXX`
 * Returns null if the phone can't be normalised.
 */
export function toWhatsAppAddress(raw: string | null | undefined): string | null {
  const e164 = normalizePhone(raw);
  if (!e164) return null;
  return `whatsapp:${e164}`;
}

/**
 * Returns a masked version of a phone number safe for logging.
 * e.g. "+97150*****67"
 */
export function maskedPhone(raw: string | null | undefined): string {
  if (!raw) return "(none)";
  const cleaned = raw.replace(/[\s\-()]/g, "");
  if (cleaned.length <= 6) return "***";
  return cleaned.slice(0, 5) + "*".repeat(cleaned.length - 7) + cleaned.slice(-2);
}

/**
 * Quick check: is this string already valid E.164?
 */
export function isE164(value: string): boolean {
  return E164_RE.test(value);
}
