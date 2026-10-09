from django.contrib import admin
from django.contrib.auth import get_user_model
from django.contrib.auth.admin import UserAdmin

from passports.models import Project, UserProjectAccess


class UserProjectAccessInline(admin.TabularInline):
    model = UserProjectAccess
    extra = 1
    verbose_name = "project access"
    verbose_name_plural = "Project / depot access"


class PassportUserAdmin(UserAdmin):
    inlines = [UserProjectAccessInline]
    list_display = ("username", "first_name", "last_name", "is_active", "is_staff", "is_superuser")


User = get_user_model()
admin.site.unregister(User)
admin.site.register(User, PassportUserAdmin)


@admin.register(Project)
class ProjectAdmin(admin.ModelAdmin):
    list_display = ("name", "slug", "depot", "is_active")
    prepopulated_fields = {"slug": ("name",)}
