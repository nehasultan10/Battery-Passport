"""Client for the Voltrack APIs battery-passport endpoints.

The passport backend authenticates the technician and checks their depot
access, then calls this service with one service key (`x-api-key`, never sent
to the app). The service owns all battery master data, including which serial
sits in which pack slot of which vehicle, so nothing about vehicles or serials
is stored in this project's database.

Endpoints used (base URL ends in /api/v1):
  GET   /battery-passport?depot=&view=summary|full&limit=&offset=      (list, paged)
  GET   /battery-passport/{registration_number}                        (one full record -> {"data": {...}})
  PATCH /battery-passport/{registration_number}   (body: battery_pack_a|b|c)

Upstream quirks this client works around:
  * `registration_number` must be the full 10-character number, and
    `battery_serial` only matches pack A exactly (case-sensitive), while packs
    B/C are stored with stray leading spaces. So serial lookup and partial
    search list the depot (`view=summary`, a few hundred rows) and match here.
"""
from urllib.parse import quote

import requests
from django.conf import settings
from django.core.cache import cache

TIMEOUT = 15
PAGE_SIZE = 500
LIST_CACHE_SECONDS = 30  # scan-heavy shifts shouldn't re-download the depot list on every scan

PASSPORT_PATH = "/battery-passport"
PACK_FIELDS = {"a": "battery_pack_a", "b": "battery_pack_b", "c": "battery_pack_c"}


class BatteryApiError(Exception):
    def __init__(self, status, detail, code=None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.code = code


def _norm(value):
    return (value or "").strip().upper() if isinstance(value, str) else ""


def _clean(vehicle):
    """Upstream pads some strings with spaces (e.g. '           A00807'); trim them all."""
    return {k: v.strip() if isinstance(v, str) else v for k, v in vehicle.items()}


def _detail_of(body):
    detail = body.get("detail") if isinstance(body, dict) else None
    if isinstance(detail, list):  # request-validation errors
        detail = "; ".join(str(d.get("msg", d)) if isinstance(d, dict) else str(d) for d in detail)
    return detail


class BatteryApiClient:
    def _request(self, method, path, **kwargs):
        if not settings.BATTERY_API_BASE_URL or not settings.BATTERY_API_KEY:
            raise BatteryApiError(502, "Battery data service is not configured on the server.")
        headers = {"x-api-key": settings.BATTERY_API_KEY, "Accept": "application/json"}
        try:
            return requests.request(
                method, settings.BATTERY_API_BASE_URL.rstrip("/") + path, headers=headers, timeout=TIMEOUT, **kwargs
            )
        except requests.RequestException as exc:
            raise BatteryApiError(502, f"Could not reach the battery data service: {exc}")

    @staticmethod
    def _body(r):
        try:
            return r.json()
        except ValueError:
            return {}

    def _raise_for(self, r):
        body = self._body(r)
        status = 400 if r.status_code == 422 else r.status_code
        raise BatteryApiError(
            status if status < 500 else 502,
            _detail_of(body) or f"Battery data service returned {r.status_code}.",
            body.get("code") if isinstance(body, dict) else None,
        )

    # ── reads ────────────────────────────────────────────────────────────────
    @staticmethod
    def _list_key(depot):
        return f"battery-list:{_norm(depot) or '*'}"

    def _list(self, depot=None, fresh=False):
        """Every passport (summary view, whitespace-trimmed), optionally for one depot."""
        key = self._list_key(depot)
        if not fresh:
            hit = cache.get(key)
            if hit is not None:
                return hit
        rows, offset = [], 0
        while True:
            params = {"view": "summary", "limit": PAGE_SIZE, "offset": offset}
            if depot:
                params["depot"] = depot
            r = self._request("GET", PASSPORT_PATH, params=params)
            if r.status_code != 200:
                self._raise_for(r)
            body = r.json()
            rows += [_clean(v) for v in body["data"]]
            offset += body["count"]
            if not body["count"] or offset >= body["total"]:
                break
        cache.set(key, rows, LIST_CACHE_SECONDS)
        return rows

    def get_vehicle(self, depot, registration_number):
        """Full passport for an exact registration number within the depot, or None."""
        r = self._request("GET", f"{PASSPORT_PATH}/{quote(registration_number.strip(), safe='')}")
        if r.status_code in (400, 404, 422):  # not a full registration number, or no such record
            return None
        if r.status_code != 200:
            self._raise_for(r)
        vehicle = (r.json() or {}).get("data")
        if isinstance(vehicle, dict) and _norm(vehicle.get("depot")) == _norm(depot):
            return _clean(vehicle)
        return None

    def search_vehicles(self, depot, q, acting_user=None):
        q = q.strip().upper()
        return [v for v in self._list(depot) if q in _norm(v.get("registration_number"))][:25]

    def resolve_serial(self, depot, serial, acting_user=None):
        """The vehicle a scanned serial (or passport ID) is on within the depot, or None."""
        wanted = _norm(serial)
        for v in self._list(depot):
            if wanted in {_norm(v.get(f)) for f in (*PACK_FIELDS.values(), "battery_passport_id")} - {""}:
                return self.get_vehicle(depot, v["registration_number"])
        return None

    # ── writes ───────────────────────────────────────────────────────────────
    def _patch(self, vehicle, fields):
        r = self._request("PATCH", f"{PASSPORT_PATH}/{vehicle['registration_number']}", json=fields)
        if r.status_code not in (200, 201):
            self._raise_for(r)
        cache.delete_many([self._list_key(None), self._list_key(vehicle.get("depot"))])  # rows changed

    def assign_serial(self, depot, payload, acting_user=None):
        """Put `serial` in the vehicle's pack slot and return the updated vehicle.

        409s (code SERIAL_ON_OTHER_VEHICLE / SLOT_TAKEN) unless payload["force"], in which
        case the serial is first released from wherever it was and the slot is overwritten.
        """
        field = PACK_FIELDS[payload["pack_slot"]]
        reg, serial = payload["registration_number"].strip(), payload["serial"].strip()
        vehicle = self.get_vehicle(depot, reg)
        if not vehicle:
            raise BatteryApiError(404, f"No vehicle '{reg}' in this depot.")
        reg = vehicle["registration_number"]

        if _norm(vehicle.get(field)) == _norm(serial):
            return vehicle  # already assigned here: idempotent

        holder = next(
            ((v, f) for v in self._list(None, fresh=True) for f in PACK_FIELDS.values()
             if _norm(v.get(f)) == _norm(serial)),
            None,
        )
        if holder and (not payload.get("force") or _norm(holder[0].get("depot")) != _norm(depot)):
            # Even with force, a depot technician can't take a serial off another depot's vehicle.
            h, f = holder
            raise BatteryApiError(409, f"{serial} is already on {h['registration_number']} (pack {f[-1].upper()}).", "SERIAL_ON_OTHER_VEHICLE")
        if vehicle.get(field) and not payload.get("force"):
            raise BatteryApiError(409, f"Pack {field[-1].upper()} on {reg} already holds {vehicle[field]}.", "SLOT_TAKEN")

        if holder:  # release the old holder first so the serial is never on two vehicles
            h, f = holder
            self._patch(h, {f: None})
        self._patch(vehicle, {field: serial})
        return self.get_vehicle(depot, reg)


client = BatteryApiClient()
