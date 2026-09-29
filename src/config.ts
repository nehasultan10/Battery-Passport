// Default points at the production Voltrack host (see voltrack/voltrack/settings.py
// ALLOWED_HOSTS). Overridable in-app (Settings screen) for local/dev/ngrok use —
// stored in SecureStore, not hardcoded, so the same build works in both.
export const DEFAULT_BASE_URL = "https://voltrack.transvolt.org";

// battery/urls.py mounts the Ninja API under the "battery" app namespace, which
// dashboard.middleware.ProjectURLMiddleware treats as project-scoped: an
// unprefixed request gets redirected to /<project>/battery/... based on
// session state, which this stateless app never has. Login and project-listing
// are project-agnostic operations (see battery/api.py: list_my_projects makes
// no depot filter), so we bootstrap them against the server's own hardcoded
// default project (get_default_project_code() in dashboard/project_routing.py)
// rather than relying on the redirect firing correctly for every HTTP client.
export const BOOTSTRAP_PROJECT_SLUG = "ultratech";

export const API_PREFIX = "/battery/api/battery-master";

export const MAX_RECENT_SCANS = 50;
export const MAX_CACHED_PASSPORTS = 20;
