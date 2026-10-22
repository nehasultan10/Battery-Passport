from typing import Any

from ninja import Schema


class ErrorOut(Schema):
    detail: str


class LoginIn(Schema):
    username: str
    password: str


class RefreshIn(Schema):
    refresh: str


class TokenPairOut(Schema):
    access: str
    refresh: str
    expires_in: int


class AccessOut(Schema):
    access: str
    expires_in: int


class MeOut(Schema):
    id: int
    username: str
    is_staff: bool


class ProjectOut(Schema):
    name: str
    slug: str


class MappingIn(Schema):
    registration_number: str
    pack_slot: str  # "a" | "b" | "c"
    serial: str
    force: bool = False


class PassportCreateIn(Schema):
    """Fields a technician can set when creating a passport. All text; the battery data API validates
    types (numbers as strings are accepted, dates are YYYY-MM-DD). Depot is set from the project."""
    registration_number: str
    chassis_no: str | None = None
    model: str | None = None
    manufacturer: str | None = None
    chemistry: str | None = None
    battery_category: str | None = None
    status: str | None = None
    battery_pack_a: str | None = None
    battery_pack_b: str | None = None
    battery_pack_c: str | None = None
    manufacturing_date: str | None = None
    manufacturing_batch: str | None = None
    manufacturing_place: str | None = None
    nominal_voltage_v: str | None = None
    nominal_capacity_ah: str | None = None
    nominal_energy_kwh: str | None = None
    usable_energy_kwh: str | None = None
    battery_weight_kg: str | None = None


class PassportListOut(Schema):
    data: list[dict[str, Any]]
    total: int
    limit: int
    offset: int


class ScanOut(Schema):
    serial: str
    vehicle: dict[str, Any]
