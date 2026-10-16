# ============================================================
# Django REST Framework imports
# ============================================================

from rest_framework.permissions import BasePermission, SAFE_METHODS


# ============================================================
# Shared role definitions
# ============================================================

ADMIN_ROLE = "ADMIN"

CRM_READ_ROLES = {
    "SALES",
    "MARKETING",
    "SUPPORT",
    "OPERATIONS",
    "MANAGEMENT",
}

CRM_WRITE_METHODS = {"POST", "PUT", "PATCH"}


# ============================================================
# Base role permission
# ============================================================

class HasRole(BasePermission):
    """Allow authenticated users with specified roles."""

    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in self.allowed_roles
            )
        )


# ============================================================
# Single-role and combined-role permissions
# ============================================================

class IsAdmin(HasRole):
    allowed_roles = ("ADMIN",)


class IsSales(HasRole):
    allowed_roles = ("SALES",)


class IsMarketing(HasRole):
    allowed_roles = ("MARKETING",)


class IsSupport(HasRole):
    allowed_roles = ("SUPPORT",)


class IsAdminOrManagement(HasRole):
    allowed_roles = ("ADMIN", "MANAGEMENT")


class IsSalesOrAdmin(HasRole):
    allowed_roles = ("ADMIN", "SALES")


class IsMarketingOrAdmin(HasRole):
    allowed_roles = ("ADMIN", "MARKETING")


class IsSupportOrAdmin(HasRole):
    allowed_roles = ("ADMIN", "SUPPORT")


class IsManagementOrAdmin(HasRole):
    allowed_roles = ("ADMIN", "MANAGEMENT")


# ============================================================
# Admin and read-only permissions
# ============================================================

class IsAdminOrReadOnly(BasePermission):
    """Admin has full access; other authenticated users can read."""

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == ADMIN_ROLE:
            return True

        return request.method in SAFE_METHODS


class IsAdminOrRoleReadOnly(BasePermission):
    """Admin has full access; configured roles have read-only access."""

    allowed_read_roles = set()

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == ADMIN_ROLE:
            return True

        return (
            request.method in SAFE_METHODS
            and user.role in self.allowed_read_roles
        )


class IsSalesReadOnlyOrAdmin(IsAdminOrRoleReadOnly):
    allowed_read_roles = CRM_READ_ROLES


class IsSupportReadOnlyOrAdmin(IsAdminOrRoleReadOnly):
    allowed_read_roles = CRM_READ_ROLES


class IsCRMRoleOrAdminReadOnly(IsAdminOrRoleReadOnly):
    allowed_read_roles = CRM_READ_ROLES


# ============================================================
# Shared read/write permission base
# ============================================================

class CRMReadWritePermission(BasePermission):
    """
    Admin: full access.
    Configured CRM roles: read-only or restricted write access.
    """

    read_roles = CRM_READ_ROLES
    write_roles = set()
    write_methods = CRM_WRITE_METHODS

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        # Administrators bypass role-specific restrictions.
        if user.is_superuser or user.role == ADMIN_ROLE:
            return True

        # Read access for permitted CRM roles.
        if request.method in SAFE_METHODS:
            return user.role in self.read_roles

        # Restricted write access; DELETE is not allowed by default.
        return (
            user.role in self.write_roles
            and request.method in self.write_methods
        )


# ============================================================
# CRM resource-specific permissions
# ============================================================

class IsSalesWriteOrSupportReadOnly(CRMReadWritePermission):
    """
    Sales: create and update.
    Support and other configured CRM roles: read-only.
    Admin: full access.
    """

    write_roles = {"SALES"}


class IsInteractionAllowed(CRMReadWritePermission):
    """
    Sales and Support: create and update interactions.
    Other configured CRM roles: read-only.
    Admin: full access.
    """

    write_roles = {"SALES", "SUPPORT"}


class IsSegmentAllowed(CRMReadWritePermission):
    """
    Marketing: create and update segments.
    Other configured CRM roles: read-only.
    Admin: full access.
    """

    write_roles = {"MARKETING"}


class IsCampaignAllowed(CRMReadWritePermission):
    """
    Marketing: create and update campaigns.
    Other configured CRM roles: read-only.
    Admin: full access.
    """

    write_roles = {"MARKETING"}