from django.contrib import admin
from django.contrib.auth.admin import UserAdmin

from .models import User, Organization


@admin.register(User)
class CustomUserAdmin(UserAdmin):

    model = User

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

    fieldsets = (
        (None, {
            "fields": (
                "email",
                "password",
            )
        }),

        ("Personal Information", {
            "fields": (
                "first_name",
                "last_name",
            )
        }),

        ("CRM Access", {
            "fields": (
                "role",
                "organization",
            )
        }),

        ("Permissions", {
            "fields": (
                "is_active",
                "is_staff",
                "is_superuser",
                "groups",
                "user_permissions",
            )
        }),

        ("Important Dates", {
            "fields": (
                "last_login",
                "date_joined",
            )
        }),
    )

    add_fieldsets = (
        (None, {
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
        }),
    )


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):

    list_display = (
        "name",
        "created_at",
        "updated_at",
    )

    search_fields = ("name",)