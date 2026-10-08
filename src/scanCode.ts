// A real pack serial / passport ID: starts alphanumeric, then alphanumerics
// and a few separators. Rejects whitespace, control characters and very long
// payloads, so an arbitrary QR (vCard, Wi-Fi config, long URL) is never
// treated as a battery serial or offered for mapping.
const SERIAL_RE = /^[A-Za-z0-9][A-Za-z0-9._\-/]{2,63}$/;

export function looksLikeSerial(value: string): boolean {
  return SERIAL_RE.test(value);
}

const URL_RE = /^[a-z][a-z0-9+.-]*:\/\/[^/?#]+(\/[^?#]*)?(\?[^#]*)?/i;
const QUERY_KEYS = ["code", "id", "serial", "passport_id"];

function safeDecode(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

/**
 * Turns whatever a QR decoded to into the code to look up, or null if it
 * isn't plausibly a battery label. Manufacturer labels encode a bare pack
 * serial; a URL-style label (ours may grow one) yields its last path segment
 * or a code/id/serial/passport_id query parameter — never the hostname.
 */
export function extractScanCode(data: string): string | null {
  const raw = (data ?? "").trim();
  if (!raw) return null;

  const url = raw.match(URL_RE);
  if (url) {
    const segments = (url[1] ?? "").split("/").filter(Boolean);
    if (segments.length) {
      const last = safeDecode(segments[segments.length - 1]);
      return looksLikeSerial(last) ? last : null;
    }
    const query = url[2] ?? "";
    for (const key of QUERY_KEYS) {
      const m = query.match(new RegExp(`[?&]${key}=([^&]+)`, "i"));
      if (m) {
        const v = safeDecode(m[1]);
        if (looksLikeSerial(v)) return v;
      }
    }
    return null;
  }

  return looksLikeSerial(raw) ? raw : null;
}

/** Registration numbers: whitespace-insensitive, upper-case (backend matches case-insensitively but not whitespace-insensitively). */
export function normalizeRegistration(input: string): string {
  return input.replace(/\s+/g, "").toUpperCase();
}
