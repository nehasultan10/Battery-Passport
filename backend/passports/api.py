import re

from django.contrib.auth import authenticate
from django.core.cache import cache
from django.utils import timezone
from ninja import NinjaAPI

from passports import auth as tokens
from passports.battery_api import BatteryApiError, client
from passports.models import Project, RefreshToken
from passports.schemas import (
    ErrorOut, LoginIn, MappingIn, MeOut, PassportCreateIn, PassportListOut, ProjectOut, RefreshIn, ScanOut,
    TokenPairOut,
)

api = NinjaAPI(title="Battery Passport API", auth=tokens.JWTAuth(), urls_namespace="passport")

SERIAL_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9._\-/]{2,63}$")  # same rule as the app's scanCode.ts
MAX_FAILED_LOGINS = 5
LOCKOUT_SECONDS = 15 * 60


def _project_for(request, slug):
    """The Project this user may work in, or None. Checked against the DB on every request, so
    removing access in the admin takes effect immediately. Superusers see every active project."""
    qs = Project.objects.filter(slug=slug, is_active=True)
    if not request.user.is_superuser:
        qs = qs.filter(user_access__user=request.user)
    return qs.first()


NO_ACCESS = (403, {"detail": "You don't have access to this project."})


def _upstream_error(exc):
    """Map a battery data API failure to our response, keeping its conflict details."""
    status = exc.status if exc.status in (400, 404, 409) else 502
    return status, {"detail": exc.detail}


# ── Auth ─────────────────────────────────────────────────────────────────────

@api.post("/auth/login/", auth=None, response={200: TokenPairOut, 401: ErrorOut, 429: ErrorOut})
def login(request, payload: LoginIn):
    key = f"login-fail:{payload.username.lower()}:{request.META.get('REMOTE_ADDR', '')}"
    if cache.get(key, 0) >= MAX_FAILED_LOGINS:
        return 429, {"detail": "Too many failed attempts. Try again in 15 minutes."}
    user = authenticate(request, username=payload.username, password=payload.password)
    if user is None or not user.is_active:
        cache.set(key, cache.get(key, 0) + 1, LOCKOUT_SECONDS)
        return 401, {"detail": "Invalid username or password."}
    cache.delete(key)
    return 200, tokens.issue_pair(user)


@api.post("/auth/refresh/", auth=None, response={200: TokenPairOut, 401: ErrorOut})
def refresh(request, payload: RefreshIn):
    """Rotating refresh: the presented token is revoked and a new pair issued, so a stolen,
    already-used refresh token stops working."""
    data = tokens.decode(payload.refresh, "refresh")
    record = tokens.live_refresh_record(data) if data else None
    user = tokens.active_user(data["user_id"]) if record else None
    if not user:
        return 401, {"detail": "Invalid or expired refresh token."}
    record.revoked_at = timezone.now()
    record.save(update_fields=["revoked_at"])
    return 200, tokens.issue_pair(user)


@api.post("/auth/logout/", auth=None, response={204: None})
def logout(request, payload: RefreshIn):
    """Revokes the refresh token server-side. Always 204, so it can't be used to probe tokens."""
    data = tokens.decode(payload.refresh, "refresh")
    if data:
        RefreshToken.objects.filter(jti=data.get("jti"), revoked_at__isnull=True).update(revoked_at=timezone.now())
    return 204, None


@api.get("/auth/me/", response=MeOut)
def me(request):
    return request.user


@api.get("/auth/projects/", response=list[ProjectOut])
def my_projects(request):
    """Projects/depots this user may work in, for the app's project picker."""
    qs = Project.objects.filter(is_active=True)
    if not request.user.is_superuser:
        qs = qs.filter(user_access__user=request.user)
    return qs.distinct()


# ── Scan / map (project-scoped, like Voltrack's /<project>/... prefix) ───────
# All battery data lives in the battery data API; these endpoints only check
# the user's access to the project and forward the request, scoped to its depot.

@api.get("/{project_slug}/scan/", response={200: ScanOut, 403: ErrorOut, 404: ErrorOut, 502: ErrorOut})
def scan(request, project_slug: str, code: str):
    """Resolve a scanned number to its vehicle. 404 means it isn't assigned to a vehicle yet."""
    project = _project_for(request, project_slug)
    if not project:
        return NO_ACCESS
    serial = code.strip()
    try:
        vehicle = client.resolve_serial(project.depot, serial, request.user.get_username())
    except BatteryApiError as exc:
        return _upstream_error(exc)
    if not vehicle:
        return 404, {"detail": f"No vehicle in {project.name} is assigned '{serial}' yet."}
    return 200, {"serial": serial, "vehicle": vehicle}


@api.get("/{project_slug}/vehicles/", response={200: list[dict], 403: ErrorOut, 502: ErrorOut})
def vehicles(request, project_slug: str, q: str):
    """Search the project's depot by registration number, for the map screen."""
    project = _project_for(request, project_slug)
    if not project:
        return NO_ACCESS
    q = q.strip()
    if len(q) < 2:
        return 200, []
    try:
        return 200, client.search_vehicles(project.depot, q, request.user.get_username())
    except BatteryApiError as exc:
        return _upstream_error(exc)


@api.post("/{project_slug}/mappings/", response={201: ScanOut, 400: ErrorOut, 403: ErrorOut, 404: ErrorOut, 409: ErrorOut, 502: ErrorOut})
def create_mapping(request, project_slug: str, payload: MappingIn):
    """Assign a scanned serial to a vehicle in the project's depot. The battery data API enforces
    uniqueness and returns 409 on conflicts; pass force=true to reassign after the tech confirms."""
    project = _project_for(request, project_slug)
    if not project:
        return NO_ACCESS
    slot = payload.pack_slot.strip().lower()
    serial = payload.serial.strip()
    registration = payload.registration_number.strip()
    if slot not in ("a", "b", "c"):
        return 400, {"detail": "pack_slot must be one of 'a', 'b', 'c'."}
    if not SERIAL_RE.match(serial):
        return 400, {"detail": "That doesn't look like a battery serial number."}
    if not registration:
        return 400, {"detail": "registration_number is required."}
    try:
        vehicle = client.assign_serial(
            project.depot,
            {"registration_number": registration, "pack_slot": slot, "serial": serial, "force": payload.force},
            request.user.get_username(),
        )
    except BatteryApiError as exc:
        return _upstream_error(exc)
    return 201, {"serial": serial, "vehicle": vehicle}


@api.get("/{project_slug}/passports/", response={200: PassportListOut, 403: ErrorOut, 502: ErrorOut})
def passports(request, project_slug: str, q: str = "", status: str = "", limit: int = 50, offset: int = 0):
    """Paged list of the project's depot passports, optionally filtered by text and status."""
    project = _project_for(request, project_slug)
    if not project:
        return NO_ACCESS
    limit, offset = max(1, min(limit, 200)), max(0, offset)
    try:
        rows, total = client.list_vehicles(project.depot, q, status, limit, offset)
    except BatteryApiError as exc:
        return _upstream_error(exc)
    return 200, {"data": rows, "total": total, "limit": limit, "offset": offset}


@api.post("/{project_slug}/passports/", response={201: ScanOut, 400: ErrorOut, 403: ErrorOut, 409: ErrorOut, 502: ErrorOut})
def create_passport(request, project_slug: str, payload: PassportCreateIn):
    """Create a passport (one per registration number) in the project's depot."""
    project = _project_for(request, project_slug)
    if not project:
        return NO_ACCESS
    fields = payload.dict(exclude_none=True)
    registration = fields.get("registration_number", "").replace(" ", "").upper()
    if len(registration) < 6:
        return 400, {"detail": "Enter the full vehicle registration number, e.g. MH12AB1234."}
    fields["registration_number"] = registration
    try:
        vehicle = client.create_vehicle(project.depot, fields)
    except BatteryApiError as exc:
        return _upstream_error(exc)
    return 201, {"serial": registration, "vehicle": vehicle}
