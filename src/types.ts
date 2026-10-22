export interface Project {
  name: string;
  slug: string;
}

export interface TokenPair {
  access: string;
  refresh: string;
  expires_in: number;
}

// The vehicle's battery master row (from the battery data API, via the passport
// backend) plus the serial that was scanned. The UI
// renders fields by group config (see passportSections.ts) rather than by name,
// so extra battery master columns show up without a TS change here.
export interface BatteryPassport {
  id: number;
  battery_serial_number: string;
  registration_number: string;
  model: string | null;
  depot: string | null;
  status: string | null;
  [field: string]: unknown;
}

export interface AssignPackPayload {
  registration_number: string;
  pack_slot: "a" | "b" | "c";
  serial: string;
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

// One row of the passports list (the battery data API's "summary" view).
export interface PassportListItem {
  id?: number;
  registration_number: string;
  chassis_no: string | null;
  model: string | null;
  depot: string | null;
  status: string | null;
  battery_pack_a: string | null;
  battery_pack_b: string | null;
  battery_pack_c: string | null;
  [field: string]: unknown;
}

export interface PassportListResponse {
  data: PassportListItem[];
  total: number;
  limit: number;
  offset: number;
}

// Everything is text; the server (and the battery data API behind it) validates numbers and dates.
export interface NewPassportPayload {
  registration_number: string;
  status?: string;
  battery_category?: string;
  chassis_no?: string;
  model?: string;
  manufacturer?: string;
  chemistry?: string;
  battery_pack_a?: string;
  battery_pack_b?: string;
  battery_pack_c?: string;
  manufacturing_date?: string;
  manufacturing_batch?: string;
  manufacturing_place?: string;
  nominal_voltage_v?: string;
  nominal_capacity_ah?: string;
  nominal_energy_kwh?: string;
  usable_energy_kwh?: string;
  battery_weight_kg?: string;
}
