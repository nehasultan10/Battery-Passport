// The Battery Passport backend (the backend/ folder in this repo). The URL is not user-configurable:
// it is read from EXPO_PUBLIC_API_BASE_URL in the .env file at build/start time (see .env.example).
const raw = process.env.EXPO_PUBLIC_API_BASE_URL;
if (!raw) {
  throw new Error("EXPO_PUBLIC_API_BASE_URL is not set. Copy .env.example to .env and set it.");
}
export const BASE_URL = raw.trim().replace(/\/+$/, "");

// Project-scoped routes live under /api/<project-slug>/..., like the web app's
// /<project>/... prefix; login, refresh, logout and the project list are
// project-agnostic and live under /api/auth/.
export const API_PREFIX = "/api";

export const MAX_RECENT_SCANS = 50;
export const MAX_CACHED_PASSPORTS = 20;
