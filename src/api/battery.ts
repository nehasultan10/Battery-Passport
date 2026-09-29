import { BOOTSTRAP_PROJECT_SLUG } from "../config";
import { AssignPackPayload, BatteryPassport, Project, TokenPair, UsageHistoryEntry } from "../types";
import { apiRequest, buildUrl } from "./client";

export async function login(baseUrl: string, username: string, password: string): Promise<TokenPair> {
  return apiRequest<TokenPair>(buildUrl(baseUrl, BOOTSTRAP_PROJECT_SLUG, "/auth/token/"), {
    method: "POST",
    body: { username, password },
  });
}

export async function refreshAccessToken(baseUrl: string, refresh: string): Promise<{ access: string; expires_in: number }> {
  return apiRequest(buildUrl(baseUrl, BOOTSTRAP_PROJECT_SLUG, "/auth/token/refresh/"), {
    method: "POST",
    body: { refresh },
  });
}

export async function listProjects(baseUrl: string, accessToken: string): Promise<Project[]> {
  return apiRequest<Project[]>(buildUrl(baseUrl, BOOTSTRAP_PROJECT_SLUG, "/auth/projects/"), {
    accessToken,
  });
}

/**
 * Resolves whatever a QR scan decoded to. Real manufacturer labels (verified
 * against a photographed EVE Power pack label) encode that pack's own S/N,
 * not a Voltrack-generated ID — the backend matches that against
 * battery_pack_a/b/c first, falling back to battery_passport_id for labels
 * printed via the admin's own QR button. See battery/api.py resolve_battery_scan.
 */
export async function resolveScan(
  baseUrl: string,
  projectSlug: string,
  accessToken: string,
  code: string
): Promise<BatteryPassport> {
  return apiRequest<BatteryPassport>(
    buildUrl(baseUrl, projectSlug, `/master/scan/?code=${encodeURIComponent(code)}`),
    { accessToken }
  );
}

/**
 * Attaches a scanned serial that resolveScan couldn't find to a vehicle —
 * either an existing one (by registration_number) or a newly created row.
 * Throws ApiError(409, ...) if the serial's already recorded elsewhere or
 * the target slot already holds a different serial; retry with
 * `{ ...payload, force: true }` once the tech has confirmed the overwrite.
 * See battery/api.py assign_pack_to_vehicle.
 */
export async function assignPack(
  baseUrl: string,
  projectSlug: string,
  accessToken: string,
  payload: AssignPackPayload
): Promise<BatteryPassport> {
  return apiRequest<BatteryPassport>(buildUrl(baseUrl, projectSlug, "/master/assign-pack/"), {
    method: "POST",
    accessToken,
    body: payload,
  });
}

export async function listUsageHistory(
  baseUrl: string,
  projectSlug: string,
  accessToken: string,
  batteryId: number
): Promise<UsageHistoryEntry[]> {
  return apiRequest<UsageHistoryEntry[]>(
    buildUrl(baseUrl, projectSlug, `/master/${batteryId}/usage/`),
    { accessToken }
  );
}
