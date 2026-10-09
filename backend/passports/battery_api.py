"""Client for the Voltrack APIs service (the battery master data API).

The passport backend authenticates the technician and checks their depot
access, then calls this service with one service API key. The service owns
all battery master data, including which serial sits on which vehicle, so
nothing about vehicles or serials is stored in this project's database.

NOTE: the paths and field names below are the contract this client assumes.
They are all defined in this file; adjust them here when the real API is final.
"""
import requests
from django.conf import settings

TIMEOUT = 15

VEHICLES_PATH = "/battery-master/"                 # GET ?depot=&registration_number=&exact=
BY_SERIAL_PATH = "/battery-master/by-serial/"      # GET ?depot=&serial=
ASSIGN_SERIAL_PATH = "/battery-master/assign-serial/"  # POST


class BatteryApiError(Exception):
    def __init__(self, status, detail, code=None):
        super().__init__(detail)
        self.status = status
        self.detail = detail
        self.code = code


class BatteryApiClient:
    def _request(self, method, path, acting_user=None, **kwargs):
        headers = {"Authorization": f"Api-Key {settings.BATTERY_API_KEY}", "Accept": "application/json"}
        if acting_user:
            headers["X-Acting-User"] = acting_user
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
        raise BatteryApiError(r.status_code if r.status_code < 500 else 502, body.get("detail") or f"Battery data service returned {r.status_code}.", body.get("code"))

    def search_vehicles(self, depot, q, acting_user=None):
        r = self._request("GET", VEHICLES_PATH, acting_user, params={"depot": depot, "registration_number": q})
        if r.status_code != 200:
            self._raise_for(r)
        return r.json()[:25]

    def find_vehicle(self, depot, registration_number, acting_user=None):
        """Exact (case-insensitive) match, or None."""
        r = self._request("GET", VEHICLES_PATH, acting_user,
                          params={"depot": depot, "registration_number": registration_number, "exact": "true"})
        if r.status_code != 200:
            self._raise_for(r)
        wanted = registration_number.strip().lower()
        return next((v for v in r.json() if (v.get("registration_number") or "").lower() == wanted), None)

    def resolve_serial(self, depot, serial, acting_user=None):
        """The vehicle a scanned serial is assigned to within the depot, or None."""
        r = self._request("GET", BY_SERIAL_PATH, acting_user, params={"depot": depot, "serial": serial})
        if r.status_code == 404:
            return None
        if r.status_code != 200:
            self._raise_for(r)
        return r.json()

    def assign_serial(self, depot, payload, acting_user=None):
        """Returns the updated vehicle. Raises BatteryApiError (409 with a code on conflicts)."""
        r = self._request("POST", ASSIGN_SERIAL_PATH, acting_user, json={**payload, "depot": depot})
        if r.status_code not in (200, 201):
            self._raise_for(r)
        return r.json()


client = BatteryApiClient()
