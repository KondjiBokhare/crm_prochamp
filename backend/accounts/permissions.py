"""Role permissions and the public account-API access matrix.

Basic role permissions are deliberately single-role.  An accounts view that
needs an Admin uses ``IsAdmin``; it never silently grants another staff role
the same access.
"""

from rest_framework.permissions import BasePermission, SAFE_METHODS

ADMIN_ROLE = "ADMIN"
CUSTOMER_ROLE = "CUSTOMER"


# Authoritative contract exposed by GET /api/auth/role-access/.
ACCOUNT_ROLE_ACCESS = {
    "SUPER_ADMIN": {
        "allowed": [
            "GET /api/auth/me/",
            "GET /api/auth/role-access/",
            "GET, POST /api/auth/organizations/",
            "GET, POST /api/auth/staff/",
            "GET, PUT, PATCH /api/auth/staff/{id}/",
            "GET /api/crm/audit-logs/",
        ],
    },
    "ADMIN": {
        "allowed": [
            "GET /api/auth/me/",
            "GET /api/auth/role-access/",
            "GET /api/auth/staff/ (own organization)",
            "GET, PUT, PATCH /api/auth/staff/{id}/ (own organization; not own role)",
        ],
    },
    "CUSTOMER": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "SALES": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "MARKETING": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "SUPPORT": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "OPERATIONS": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "MANAGEMENT": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
    "ANALYST": {"allowed": ["GET /api/auth/me/", "GET /api/auth/role-access/"]},
}

CRM_READ_ROLES = {
    "SALES",
    "MARKETING",
    "SUPPORT",
    "OPERATIONS",
    "MANAGEMENT",
}

CRM_WRITE_METHODS = {"POST", "PUT", "PATCH"}

# Base role permission
class HasRole(BasePermission):
    """Allow authenticated users with specified roles."""

    allowed_roles = ()

    def has_permission(self, request, view):
        user = request.user

        return bool(
            user
            and user.is_authenticated
            and user.role in self.allowed_roles
        )


class IsSuperAdmin(BasePermission):
    """Allow only a Django superuser to perform global operations."""

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.is_superuser)


class IsSuperAdminOrOrganizationAdmin(BasePermission):
    """Allow a superadmin or an Admin assigned to an organization."""

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or (
                    user.role == ADMIN_ROLE
                    and user.organization_id is not None
                )
            )
        )


# Single-role permissions for accounts APIs

class IsAdmin(HasRole):
    allowed_roles = ("ADMIN",)

    def has_permission(self, request, view):
        user = request.user
        return bool(
            user
            and user.is_authenticated
            and (user.is_superuser or user.role == ADMIN_ROLE)
        )


class IsSales(HasRole):
    allowed_roles = ("SALES",)


class IsMarketing(HasRole):
    allowed_roles = ("MARKETING",)


class IsSupport(HasRole):
    allowed_roles = ("SUPPORT",)


class IsOperations(HasRole):
    allowed_roles = ("OPERATIONS",)


class IsManagement(HasRole):
    allowed_roles = ("MANAGEMENT",)


class IsAnalyst(HasRole):
    allowed_roles = ("ANALYST",)


# These are legacy CRM policies. They are not used by any accounts API.
# CRM will be moved to its own role policy module separately so this app can
# eventually expose only the single-role permissions above.
class IsAdminOrManagement(HasRole):
    allowed_roles = ("ADMIN", "MANAGEMENT")


class IsMarketingOrAdmin(HasRole):
    allowed_roles = ("ADMIN", "MARKETING")


# Admin and read-only permissions

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

# Shared read/write permission base
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


# CRM resource-specific permissions
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


class IsCustomer(HasRole):
    """Allow customers and superusers."""
    allowed_roles = (CUSTOMER_ROLE,)


class IsCustomerOwnerOrAdmin(BasePermission):
    """
    Allow customers to access their own objects.
    Administrators and superusers can access any object.

    Requires the object to have a `user` attribute
    referencing its owner.
    """

    def has_permission(self, request, view):
        user = request.user

        return bool(user and user.is_authenticated)

    def has_object_permission(self, request, view, obj):
        user = request.user

        if user.is_superuser or user.role == ADMIN_ROLE:
            return True

        return (
            user.role == CUSTOMER_ROLE
            and getattr(obj, "user_id", None) == user.id
        )


class IsPublicProductReadOnly(BasePermission):
    """
    Anyone can read public storefront resources.
    Only authenticated, authorized users can write.
    """

    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user

        return bool(
            user
            and user.is_authenticated
            and (
                user.is_superuser
                or user.role == ADMIN_ROLE
            )
        )
