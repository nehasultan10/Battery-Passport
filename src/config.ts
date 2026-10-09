// The Battery Passport backend (battery-passport-api) - its own server, users and
// database, separate from Voltrack and the battery data API. Overridable in-app (Settings screen) for
// local/dev/ngrok use; stored in SecureStore, not hardcoded.
export const DEFAULT_BASE_URL = "https://passport.transvolt.org";

// Project-scoped routes live under /api/<project-slug>/..., like the web app's
// /<project>/... prefix; login, refresh, logout and the project list are
// project-agnostic and live under /api/auth/.
export const API_PREFIX = "/api";

export const MAX_RECENT_SCANS = 50;
export const MAX_CACHED_PASSPORTS = 20;
