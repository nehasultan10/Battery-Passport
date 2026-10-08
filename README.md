# Battery Passport (mobile)

Expo / React Native app for depot staff: scan the QR code on a battery pack and pull up its full Battery Passport (compliance, materials, carbon footprint, circularity, performance/durability) from Voltrack.

Talks directly to the existing Voltrack backend at `/home/neha/Desktop/voltrack` — no separate data store. See `battery/api.py`, `battery/auth.py`, `battery/schemas.py` in that repo for the API this app calls.

## Running it

```
npm install
npx expo start
```

Scan the QR with Expo Go (Android/iOS), or press `a` / `i` for an emulator.

**The backend must be running the `passport` branch of `voltrack`** (`battery/api.py`, `battery/auth.py`). That branch is not merged or deployed yet: `https://voltrack.transvolt.org` currently answers every battery-API call with an HTML 404, so the default URL cannot work until it is. Until then run that branch yourself and point the app at it (your computer's LAN IP, e.g. `http://192.168.1.20:8000`, with the phone on the same Wi-Fi - or an ngrok URL). In Settings, **Test connection** tells you whether the address actually serves the Battery Passport API.

On first launch: **Settings** to point the app at your Voltrack server (defaults to production; use your LAN IP or ngrok URL for a local dev backend), then sign in with a normal Voltrack account.

## How identity/auth works

- Login and project-listing calls always go through a hardcoded bootstrap project (`ultratech`, matching the backend's own default — see `src/config.ts`) because those two calls are project-agnostic but still live under Voltrack's project-prefixed URL scheme.
- After login, the user picks their project (mirrors the web app's project switcher) and every subsequent call is prefixed with that project's slug.
- Auth is JWT (access token 30 min, refresh 14 days) via `battery/auth.py` — separate from the session/CSRF auth the web admin uses. `AuthContext.ensureAccessToken()` refreshes on any 401.

## QR contents

Manufacturer labels already have a QR on them — confirmed by decoding a real EVE Power pack label photo, which encoded that pack's own S/N (`04QPBFW014802JECJ2900202`) as a bare string, not a URL. So a scan is resolved via `GET /master/scan/?code=...` (`battery/api.py: resolve_battery_scan`), which matches the scanned text against `battery_pack_a/b/c` first (wherever that serial is recorded on the BatteryMaster row), falling back to `battery_passport_id` for labels printed via the admin's own "QR" button (still useful for batteries without a legible/working manufacturer code).

## Mapping an unmapped scan

A scan that doesn't resolve (`404` from `/master/scan/`) offers a "Map this battery" screen: enter the vehicle's registration number and which pack slot (A/B/C) this serial belongs to, and it's attached via `POST /master/assign-pack/` — either to an existing vehicle row or a newly created one. This writes from the mobile app, which the PRD's v1 non-goals explicitly excluded ("scanning is read-only") — built anyway per direct request, so it's worth knowing that's a deliberate deviation from the PRD, not an oversight.

The endpoint refuses to silently overwrite: if the target slot already holds a *different* serial, or that serial is already recorded on a *different* vehicle (in any of its three slots — a likely pack swap, not a typo), it returns 409 with a clear reason. The app then asks the tech to confirm before resubmitting with `force: true`.

## Behaviour worth knowing

- Signing out, switching project or changing the server URL wipes the offline passport cache and scan history on the device.
- An expired session (refresh token, 14 days) signs you out automatically.
- Requests time out after 15 s; the cached passport is shown only for connectivity/server failures, never for auth errors.
- Scans that aren't plausibly a battery serial (vCards, Wi-Fi QRs, long URLs) are ignored with a hint, and are never offered for mapping.

## Scope notes (see `Battery_Passport_PRD.docx` in the voltrack repo root for the full plan)

Built in this pass: internal authenticated passport API + mobile scan-and-view app, per-vehicle identity (not per-pack), local scan history, offline last-N-passports cache, mobile mapping for unresolved scans.

Deliberately **not** built yet (each is a real decision the PRD itself flags as open, not an oversight):
- No public/unauthenticated passport endpoint or web passport view — the QR currently encodes a bare ID, not a shareable URL, since there's nothing yet for a generic camera scan to open.
- No field-level internal/external visibility split (needs a legal/product pass per the PRD).
- No per-pack (A/B/C) independent passport identity — packs still share their vehicle's `BatteryMaster` record.
- No PDF export, rate limiting, or audit logging on the passport endpoint.
