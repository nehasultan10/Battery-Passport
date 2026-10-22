import { API_PREFIX } from "../config";

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

/**
 * True for failures where showing the last cached copy is honest: no
 * connection, a timeout (status 0) or a server-side error (5xx, which
 * includes "this URL isn't the Battery Passport API", reported as 502).
 * NOT for 401/403 (session/permission problems) or a real 404.
 */
export function isOfflineLike(err: unknown): boolean {
  return err instanceof ApiError && (err.status === 0 || err.status >= 500);
}

export const REQUEST_TIMEOUT_MS = 15000;

/** Project-scoped route: <base>/api/<project>/<path>. */
export function buildUrl(baseUrl: string, projectSlug: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  return `${trimmedBase}${API_PREFIX}/${projectSlug}${path}`;
}

/** Project-agnostic auth route: <base>/api/auth/<path>. */
export function buildAuthUrl(baseUrl: string, path: string): string {
  const trimmedBase = baseUrl.replace(/\/+$/, "");
  return `${trimmedBase}${API_PREFIX}/auth${path}`;
}

/** Returns a clean http(s) base URL without trailing slashes, or null if it isn't one. */
export function normalizeBaseUrl(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, "");
  if (!/^https?:\/\/[^\s/?#]+(:\d+)?(\/[^\s?#]*)?$/i.test(trimmed)) return null;
  return trimmed;
}

interface RequestOptions {
  method?: "GET" | "POST" | "PUT" | "DELETE";
  body?: unknown;
  accessToken?: string;
}

export async function apiRequest<T>(url: string, options: RequestOptions = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: "application/json" };
  if (options.body !== undefined) headers["Content-Type"] = "application/json";
  if (options.accessToken) headers.Authorization = `Bearer ${options.accessToken}`;

  // Without a timeout a dead-zone connection leaves the UI spinning forever
  // and the offline cache never gets a chance to kick in.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let response: Response;
  let text: string;
  try {
    response = await fetch(url, {
      method: options.method ?? "GET",
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
      signal: controller.signal,
    });
    text = await response.text();
  } catch (err) {
    if (controller.signal.aborted) {
      throw new ApiError(0, "The server took too long to respond. Check your connection and try again.");
    }
    throw new ApiError(0, "Network error — check your connection.");
  } finally {
    clearTimeout(timer);
  }

  const data = text ? safeJsonParse(text) : null;

  if (!response.ok) {
    const detail = extractDetail(data);
    if (detail) return rejectWith(response.status, detail);
    if (data === null && text) {
      // A non-JSON error page (HTML 404/502/maintenance) means we reached
      // *a* server, just not the Battery Passport API. Reported as 502 so a
      // real API 404 ("no battery for this code") stays distinguishable and
      // never offers to map a battery on the back of a wrong URL.
      const status = response.status === 404 ? 502 : response.status;
      const message =
        response.status === 404
          ? "This server doesn't have the Battery Passport API at this address (404)."
          : `Request failed (${response.status}).`;
      return rejectWith(status, message);
    }
    return rejectWith(response.status, `Request failed (${response.status}).`);
  }

  // A 2xx that isn't JSON (wrong URL, captive portal, login-page redirect)
  // must not be returned as if it were data.
  if (text && data === null) {
    throw new ApiError(502, "Unexpected response from the server (not JSON).");
  }

  return data as T;
}

function rejectWith(status: number, message: string): never {
  throw new ApiError(status, message);
}

// Ninja returns {"detail": "..."} for our own errors and
// {"detail": [{"msg": "..."}]} for request-validation (422) errors.
function extractDetail(data: unknown): string | null {
  if (!data || typeof data !== "object" || !("detail" in data)) return null;
  const detail = (data as { detail: unknown }).detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    const msgs = detail
      .map((d) => (d && typeof d === "object" && "msg" in d ? String((d as { msg: unknown }).msg) : null))
      .filter((m): m is string => !!m);
    if (msgs.length) return msgs.join("; ");
  }
  return null;
}

function safeJsonParse(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}
