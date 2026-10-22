import { API_PREFIX } from "../config";
import { AssignPackPayload, BatteryPassport, Project, TokenPair } from "../types";
import { ApiError, apiRequest, buildAuthUrl, buildUrl } from "./client";

export async function login(baseUrl: string, username: string, password: string): Promise<TokenPair> {
  return apiRequest<TokenPair>(buildAuthUrl(baseUrl, "/login/"), {
    method: "POST",
    body: { username, password },
  });
}

/** Refresh tokens rotate: the response carries a new refresh token and the old one stops working. */
export async function refreshSession(baseUrl: string, refresh: string): Promise<TokenPair> {
  return apiRequest<TokenPair>(buildAuthUrl(baseUrl, "/refresh/"), {
    method: "POST",
    body: { refresh },
  });
}

/** Revokes the refresh token on the server. Best effort: logging out locally never depends on it. */
export async function serverLogout(baseUrl: string, refresh: string): Promise<void> {
  await apiRequest(buildAuthUrl(baseUrl, "/logout/"), { method: "POST", body: { refresh } });
}

export async function listProjects(baseUrl: string, accessToken: string): Promise<Project[]> {
  return apiRequest<Project[]>(buildAuthUrl(baseUrl, "/projects/"), { accessToken });
}

interface ScanResponse {
  serial: string;
  vehicle: Record<string, unknown>;
}

function toPassport({ serial, vehicle }: ScanResponse): BatteryPassport {
  return {
    id: 0,
    model: null,
    depot: null,
    status: null,
    ...vehicle,
    battery_serial_number: serial,
    registration_number: String(vehicle.registration_number ?? ""),
  };
}

/**
 * Resolves a scanned number within the selected project's depot. 404 means it
 * isn't assigned to a vehicle yet (the app then offers the map screen).
 */
export async function resolveScan(
  baseUrl: string,
  projectSlug: string,
  accessToken: string,
  code: string
): Promise<BatteryPassport> {
  return toPassport(
    await apiRequest<ScanResponse>(buildUrl(baseUrl, projectSlug, `/scan/?code=${encodeURIComponent(code)}`), {
      accessToken,
    })
  );
}

/**
 * Assigns a scanned serial to a vehicle. Throws ApiError(409, ...) if the
 * serial is already on another vehicle or the pack slot is taken; retry with
 * `force: true` once the tech has confirmed the overwrite.
 */
export async function assignPack(
  baseUrl: string,
  projectSlug: string,
  accessToken: string,
  payload: AssignPackPayload
): Promise<BatteryPassport> {
  return toPassport(
    await apiRequest<ScanResponse>(buildUrl(baseUrl, projectSlug, "/mappings/"), {
      method: "POST",
      accessToken,
      body: payload,
    })
  );
}
