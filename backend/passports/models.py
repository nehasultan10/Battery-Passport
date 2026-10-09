import uuid

from django.conf import settings
from django.core.exceptions import ValidationError
from django.db import models


class Project(models.Model):
    """A depot/project a technician can work in (mirrors Voltrack's projects).

    slug is the URL segment (/api/<slug>/...). depot is the value sent to the
    battery data API as its depot filter, so every request is scoped to it.
    """
    name = models.CharField(max_length=100, unique=True)
    slug = models.SlugField(max_length=100, unique=True)
    depot = models.CharField(max_length=100, help_text="Depot value in the battery master data this project covers")
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = "project"
        ordering = ["name"]

    def clean(self):
        if self.slug == "auth":
            raise ValidationError({"slug": "'auth' is reserved."})

    def __str__(self):
        return self.name


class UserProjectAccess(models.Model):
    """Grants a user access to a project. Managed in the admin panel.
    Superusers are not constrained by these rows (same as Voltrack)."""
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="project_access")
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="user_access")

    class Meta:
        db_table = "user_project_access"
        constraints = [models.UniqueConstraint(fields=["user", "project"], name="one_access_row_per_user_project")]

    def __str__(self):
        return f"{self.user} -> {self.project}"


class RefreshToken(models.Model):
    """Server-side record of an issued refresh token so logout can really revoke it."""
    jti = models.UUIDField(default=uuid.uuid4, unique=True, editable=False)
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE, related_name="refresh_tokens")
    expires_at = models.DateTimeField()
    revoked_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = "refresh_token"
