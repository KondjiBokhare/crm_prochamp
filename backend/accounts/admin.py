# ============================================================
# Django admin imports
# ============================================================

from django.contrib import admin
from django.contrib.auth.admin import UserAdmin


# ============================================================
# Local model imports
# ============================================================

from .models import Organization, User


# ============================================================
# Custom User Admin
# ============================================================

@admin.register(User)
class CustomUserAdmin(UserAdmin):
    """Configure user management in the Django admin panel."""

    model = User

    # User list page
    list_display = (
        "email",
        "role",
        "organization",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    list_filter = (
        "role",
        "organization",
        "is_active",
        "is_staff",
        "is_superuser",
    )

    search_fields = (
        "email",
        "first_name",
        "last_name",
    )

    ordering = ("email",)

    # Existing user detail/edit page
    fieldsets = (
        (
            None,
            {
                "fields": (
                    "email",
                    "password",
                ),
            },
        ),
        (
            "Personal Information",
            {
                "fields": (
                    "first_name",
                    "last_name",
                ),
            },
        ),
        (
            "CRM Access",
            {
                "fields": (
                    "role",
                    "organization",
                ),
            },
        ),
        (
            "Permissions",
            {
                "fields": (
                    "is_active",
                    "is_staff",
                    "is_superuser",
                    "groups",
                    "user_permissions",
                ),
            },
        ),
        (
            "Important Dates",
            {
                "fields": (
                    "last_login",
                    "date_joined",
                ),
            },
        ),
    )

    # New user creation page
    add_fieldsets = (
        (
            None,
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "role",
                    "organization",
                    "is_staff",
                    "is_active",
                ),
            },
        ),
    )

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser


# ============================================================
# Organization Admin
# ============================================================

@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    """Configure organization management in the admin panel."""

    list_display = (
        "name",
        "created_at",
        "updated_at",
    )

    search_fields = ("name",)
    ordering = ("name",)
    readonly_fields = (
        "created_at",
        "updated_at",
    )

    def has_module_permission(self, request):
        return request.user.is_superuser

    def has_view_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_add_permission(self, request):
        return request.user.is_superuser

    def has_change_permission(self, request, obj=None):
        return request.user.is_superuser

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser
