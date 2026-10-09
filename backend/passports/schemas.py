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


class ScanOut(Schema):
    serial: str
    vehicle: dict[str, Any]
