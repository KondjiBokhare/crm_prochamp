from rest_framework.permissions import BasePermission, SAFE_METHODS
class HasRole(BasePermission):

    allowed_roles = []

    def has_permission(self, request, view):
        return (
            request.user.is_authenticated
            and request.user.role in self.allowed_roles
        )


class IsAdmin(HasRole):
    allowed_roles = ["ADMIN"]


class IsSales(HasRole):
    allowed_roles = ["SALES"]


class IsMarketing(HasRole):
    allowed_roles = ["MARKETING"]


class IsSupport(HasRole):
    allowed_roles = ["SUPPORT"]


class IsAdminOrManagement(HasRole):
    allowed_roles = ["ADMIN", "MANAGEMENT"]

class IsAdminOrReadOnly(BasePermission):
    """
    Admins can perform all actions.
    Other authenticated roles can only use safe HTTP methods.
    """
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        return request.method in SAFE_METHODS


class IsSalesOrAdmin(BasePermission):
    """Sales and Admin can create or update CRM records."""
    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in {"ADMIN", "SALES"}
            )
        )


class IsMarketingOrAdmin(BasePermission):
    """Marketing and Admin can manage campaign functionality."""
    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in {"ADMIN", "MARKETING"}
            )
        )


class IsSupportOrAdmin(BasePermission):
    """Support and Admin can manage customer interactions."""
    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in {"ADMIN", "SUPPORT"}
            )
        )


class IsManagementOrAdmin(BasePermission):
    """Management and Admin can access management functionality."""
    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role in {"ADMIN", "MANAGEMENT"}
            )
        )
class IsAdminOrRoleReadOnly(BasePermission):
    """
    Admin: full access.
    Specified roles: read-only access.
    """
    allowed_read_roles = set()

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        return (
            request.method in SAFE_METHODS
            and user.role in self.allowed_read_roles
        )


class IsSalesReadOnlyOrAdmin(IsAdminOrRoleReadOnly):
    allowed_read_roles = {
        "SALES",
        "MARKETING",
        "SUPPORT",
        "MANAGEMENT",
        "OPERATIONS",
    }


class IsSupportReadOnlyOrAdmin(IsAdminOrRoleReadOnly):
    allowed_read_roles = {
        "SALES",
        "MARKETING",
        "SUPPORT",
        "MANAGEMENT",
        "OPERATIONS",
    }


class IsSalesWriteOrSupportReadOnly(BasePermission):
    """
    Admin: full access.
    Sales: read/write, except deletion.
    Support: read-only.
    """
    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        if request.method in SAFE_METHODS:
            return user.role in {
                "SALES",
                "MARKETING",
                "SUPPORT",
                "MANAGEMENT",
                "OPERATIONS",
            }

        return (
            user.role == "SALES"
            and request.method in {"POST", "PUT", "PATCH"}
        )


class IsInteractionAllowed(BasePermission):
    """
    Admin: full access.
    Sales and Support: read/write, but no deletion.
    Other CRM roles: read-only.
    """
    read_roles = {
        "SALES",
        "MARKETING",
        "SUPPORT",
        "MANAGEMENT",
        "OPERATIONS",
    }

    write_roles = {"SALES", "SUPPORT"}

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        if request.method in SAFE_METHODS:
            return user.role in self.read_roles

        return (
            user.role in self.write_roles
            and request.method in {"POST", "PUT", "PATCH"}
        )


class IsSegmentAllowed(BasePermission):
    """
    Admin: full access.
    Marketing: create/update segments, but cannot delete.
    Other CRM roles: read-only.
    """
    read_roles = {
        "SALES",
        "MARKETING",
        "SUPPORT",
        "MANAGEMENT",
        "OPERATIONS",
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        if request.method in SAFE_METHODS:
            return user.role in self.read_roles

        return (
            user.role == "MARKETING"
            and request.method in {"POST", "PUT", "PATCH"}
        )


class IsCampaignAllowed(BasePermission):
    """
    Admin: full access.
    Marketing: manage campaigns, but cannot delete.
    Other CRM roles: read-only.
    """
    read_roles = {
        "SALES",
        "MARKETING",
        "SUPPORT",
        "MANAGEMENT",
        "OPERATIONS",
    }

    def has_permission(self, request, view):
        user = request.user

        if not user or not user.is_authenticated:
            return False

        if user.is_superuser or user.role == "ADMIN":
            return True

        if request.method in SAFE_METHODS:
            return user.role in self.read_roles

        return (
            user.role == "MARKETING"
            and request.method in {"POST", "PUT", "PATCH"}
        )
