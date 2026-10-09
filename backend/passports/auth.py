import datetime as dt

import jwt
from django.conf import settings
from django.contrib.auth import get_user_model
from django.utils import timezone
from ninja.security import HttpBearer

from passports.models import RefreshToken

ALGORITHM = "HS256"
ACCESS_TTL = dt.timedelta(minutes=15)
REFRESH_TTL = dt.timedelta(days=14)


def _encode(user, token_type, ttl, jti=None):
    now = dt.datetime.now(dt.timezone.utc)
    payload = {"user_id": user.pk, "type": token_type, "iat": now, "exp": now + ttl}
    if jti:
        payload["jti"] = str(jti)
    return jwt.encode(payload, settings.SECRET_KEY, algorithm=ALGORITHM)


def issue_access(user):
    return {"access": _encode(user, "access", ACCESS_TTL), "expires_in": int(ACCESS_TTL.total_seconds())}


def issue_pair(user):
    record = RefreshToken.objects.create(user=user, expires_at=timezone.now() + REFRESH_TTL)
    return {**issue_access(user), "refresh": _encode(user, "refresh", REFRESH_TTL, record.jti)}


def decode(token, expected_type):
    try:
        payload = jwt.decode(token, settings.SECRET_KEY, algorithms=[ALGORITHM])
    except jwt.PyJWTError:
        return None
    return payload if payload.get("type") == expected_type else None


def active_user(user_id):
    return get_user_model().objects.filter(pk=user_id, is_active=True).first()


def live_refresh_record(payload):
    """The RefreshToken row for this token if it hasn't been revoked or expired."""
    return RefreshToken.objects.filter(
        jti=payload.get("jti"), user_id=payload.get("user_id"), revoked_at__isnull=True, expires_at__gt=timezone.now()
    ).first()


class JWTAuth(HttpBearer):
    def authenticate(self, request, token):
        payload = decode(token, "access")
        user = active_user(payload["user_id"]) if payload else None
        if user:
            request.user = user
        return user
