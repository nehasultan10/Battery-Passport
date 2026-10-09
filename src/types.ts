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
