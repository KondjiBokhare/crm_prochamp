
from django import forms
from django.contrib import admin
from django.contrib.auth.admin import UserAdmin
from django.contrib.auth.forms import UserChangeForm, UserCreationForm

from .models import Organization, User


CRM_PAGE_PERMISSION_CHOICES = (
    ("dashboard", "Dashboard"),
    ("customers", "Customers"),
    ("leads", "Leads"),
    ("orders", "Orders"),
    ("shipments", "Shipments"),
    ("returns", "Returns"),
    ("orderActivity", "Order Activity"),
    ("support", "Support Tickets"),
    ("customerDetails", "Customer Details"),
    ("interactions", "Interactions"),
    ("segments", "Customer Segments"),
    ("campaigns", "Campaigns"),
    ("communications", "Communications"),
    ("banners", "Banner Management"),
    ("products", "Product Management"),
    ("productReviews", "Product Reviews"),
    ("categories", "Category Management"),
    ("storefrontSettings", "Storefront Settings"),
    ("homepagePromotions", "Homepage Promotions"),
    ("userManagement", "User Management"),
    ("analytics", "Analytics"),
    ("auditLogs", "Audit Logs"),
    ("inventory", "Inventory"),
    ("coupons", "Coupons & Discounts"),
    ("abandonedCarts", "Abandoned Carts"),
)


def crm_permissions_field():
    return forms.MultipleChoiceField(
        choices=CRM_PAGE_PERMISSION_CHOICES,
        widget=forms.CheckboxSelectMultiple,
        required=False,
        label="CRM Module Permissions",
        help_text=(
            "Select the CRM modules this user is authorized to access."
        ),
    )


class CustomUserChangeForm(UserChangeForm):
    crm_permissions = crm_permissions_field()

    class Meta(UserChangeForm.Meta):
        model = User
        fields = "__all__"


class CustomUserCreationForm(UserCreationForm):
    crm_permissions = crm_permissions_field()

    class Meta(UserCreationForm.Meta):
        model = User
        fields = (
            "email",
            "password1",
            "password2",
            "first_name",
            "last_name",
            "role",
            "organization",
            "crm_permissions",
            "is_staff",
            "is_active",
        )


@admin.register(User)
class CustomUserAdmin(UserAdmin):
    model = User

    form = CustomUserChangeForm
    add_form = CustomUserCreationForm

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

    search_fields = ("email", "first_name", "last_name")
    ordering = ("email",)

    filter_horizontal = ("groups", "user_permissions")

    fieldsets = (
        (
            None,
            {"fields": ("email", "password")},
        ),
        (
            "Personal Information",
            {
                "fields": ("first_name", "last_name"),
            },
        ),
        (
            "CRM Access",
            {
                "description": (
                    "Select the CRM pages this user can access. "
                    "These permissions are separate from Django permissions."
                ),
                "fields": (
                    "role",
                    "organization",
                    "crm_permissions",
                ),
            },
        ),
        (
            "Django Permissions",
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
                "fields": ("last_login", "date_joined"),
            },
        ),
    )

    add_fieldsets = (
        (
            "Create User",
            {
                "classes": ("wide",),
                "fields": (
                    "email",
                    "password1",
                    "password2",
                    "first_name",
                    "last_name",
                    "role",
                    "organization",
                    "crm_permissions",
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


@admin.register(Organization)
class OrganizationAdmin(admin.ModelAdmin):
    list_display = ("name", "created_at", "updated_at")
    search_fields = ("name",)
    ordering = ("name",)

    readonly_fields = ("created_at", "updated_at")

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
