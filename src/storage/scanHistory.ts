import AsyncStorage from "@react-native-async-storage/async-storage";
import { MAX_CACHED_PASSPORTS, MAX_RECENT_SCANS } from "../config";
import { BatteryPassport, CachedPassport, ScanHistoryEntry } from "../types";

const SCANS_KEY = "battery-passport:scan-history";
const CACHE_KEY = "battery-passport:passport-cache";
const ALIAS_KEY = "battery-passport:passport-cache-aliases";

// Stored JSON can be corrupt (interrupted write, app update); treat that as
// "nothing stored" rather than letting a parse error break screens.
function safeParse<T>(raw: string | null, fallback: T): T {
  if (!raw) return fallback;
  try {
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? (parsed as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function getScanHistory(): Promise<ScanHistoryEntry[]> {
  const parsed = safeParse<ScanHistoryEntry[]>(await AsyncStorage.getItem(SCANS_KEY), []);
  return Array.isArray(parsed) ? parsed : [];
}

/**
 * Wipes everything cached on this device (scan history + offline passports).
 * Called on logout, project switch and server change, so another user or
 * project never sees the previous one's batteries.
 */
export async function clearAllLocalData(): Promise<void> {
  await Promise.all([
    AsyncStorage.removeItem(SCANS_KEY),
    AsyncStorage.removeItem(CACHE_KEY),
    AsyncStorage.removeItem(ALIAS_KEY),
  ]);
}

export async function addScanHistoryEntry(entry: ScanHistoryEntry): Promise<void> {
  const existing = await getScanHistory();
  const deduped = existing.filter((e) => e.passportId !== entry.passportId);
  const next = [entry, ...deduped].slice(0, MAX_RECENT_SCANS);
  await AsyncStorage.setItem(SCANS_KEY, JSON.stringify(next));
}

export async function clearScanHistory(): Promise<void> {
  await AsyncStorage.removeItem(SCANS_KEY);
}

function normalizeCode(code: string): string {
  return code.trim().toLowerCase();
}

// battery_pack_a/b/c + battery_passport_id are all values the backend's
// resolve_battery_scan will match a scan against (see battery/api.py), so
// any of them scanned later should hit this same cached record offline.
function aliasesFor(passport: BatteryPassport): string[] {
  const candidates = [
    passport.battery_passport_id,
    passport.battery_pack_a,
    passport.battery_pack_b,
    passport.battery_pack_c,
  ];
  return candidates
    .filter((v): v is string => typeof v === "string" && v.length > 0)
    .map(normalizeCode);
}

// Read-only, last-N-passports cache so a technician in a dead zone still sees
// the last known record — surfaced with a "cached as of" banner in the UI so
// it's never mistaken for a live read (PRD section 7). Indexed by every code
// that can resolve to a battery (not just battery_passport_id), so a re-scan
// of the same physical label works offline too.
export async function cachePassport(passport: BatteryPassport): Promise<void> {
  const passportId = String(passport.battery_passport_id ?? `id-${passport.id}`);

  const [rawCache, rawAliases] = await Promise.all([
    AsyncStorage.getItem(CACHE_KEY),
    AsyncStorage.getItem(ALIAS_KEY),
  ]);
  const cache = safeParse<Record<string, CachedPassport>>(rawCache, {});
  const aliases = safeParse<Record<string, string>>(rawAliases, {});

  cache[passportId] = { passport, cachedAt: new Date().toISOString() };
  for (const alias of aliasesFor(passport)) {
    aliases[alias] = passportId;
  }

  const entries = Object.entries(cache).sort(
    (a, b) => new Date(b[1].cachedAt).getTime() - new Date(a[1].cachedAt).getTime()
  );
  const trimmedEntries = entries.slice(0, MAX_CACHED_PASSPORTS);
  const trimmedCache = Object.fromEntries(trimmedEntries);
  const keptIds = new Set(trimmedEntries.map(([id]) => id));
  const trimmedAliases = Object.fromEntries(Object.entries(aliases).filter(([, id]) => keptIds.has(id)));

  await Promise.all([
    AsyncStorage.setItem(CACHE_KEY, JSON.stringify(trimmedCache)),
    AsyncStorage.setItem(ALIAS_KEY, JSON.stringify(trimmedAliases)),
  ]);
}

export async function getCachedPassport(code: string): Promise<CachedPassport | null> {
  const [rawCache, rawAliases] = await Promise.all([
    AsyncStorage.getItem(CACHE_KEY),
    AsyncStorage.getItem(ALIAS_KEY),
  ]);
  if (!rawCache) return null;
  const cache = safeParse<Record<string, CachedPassport>>(rawCache, {});
  const aliases = safeParse<Record<string, string>>(rawAliases, {});

  const passportId = aliases[normalizeCode(code)] ?? code;
  return cache[passportId] ?? null;
}
