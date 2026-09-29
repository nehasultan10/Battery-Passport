export interface Project {
  code: string;
  name: string;
  slug: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
  expires_in: number;
}

// Mirrors battery/schemas.py BatteryMasterOut — fields = "__all__" on the
// ~90-column BatteryMaster model (battery/models/battery_master.py). Typed as
// Record passthrough since the UI renders fields by group config (see
// passportSections.ts) rather than by name, so new model columns show up
// without a TS change here; the explicit fields are the ones referenced by
// id/name outside the generic group renderer.
export interface BatteryPassport {
  id: number;
  registration_number: string;
  battery_passport_id: string | null;
  model: string | null;
  depot: string | null;
  status: string | null;
  [field: string]: unknown;
}

export interface UsageHistoryEntry {
  id: number;
  battery_id: number;
  date: string;
  distance_km: string;
  energy_charged_kwh: string;
  energy_discharged_kwh: string;
  cycle_count: string;
  soh_percent: string | null;
  capacity_kwh: string | null;
  max_temperature: string | null;
  min_temperature: string | null;
  thermal_event_count: number;
}

export interface AssignPackPayload {
  registration_number: string;
  pack_slot: "a" | "b" | "c";
  serial: string;
  model?: string;
  chassis_no?: string;
  depot?: string;
  force?: boolean;
}

export interface ScanHistoryEntry {
  passportId: string;
  registrationNumber: string;
  model: string | null;
  scannedAt: string;
}

export interface CachedPassport {
  passport: BatteryPassport;
  cachedAt: string;
}
