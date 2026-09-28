from rest_framework.permissions import BasePermission


ROLE_PERMISSIONS = {
    "ADMIN": {
        "users.view",
        "users.manage",
        "roles.manage",
        "system.manage",
        "audit.view",
    },

    "SALES": {
        "customers.view",
        "leads.view",
        "leads.create",
        "leads.update",
        "deals.view",
        "deals.create",
        "deals.update",
        "sales_dashboard.view",
    },

    "MARKETING": {
        "customers.view",
        "campaigns.view",
        "campaigns.create",
        "campaigns.update",
        "marketing_dashboard.view",
    },

    "SUPPORT": {
        "customers.view",
        "tickets.view",
        "tickets.create",
        "tickets.update",
        "support_dashboard.view",
    },

    "MANAGEMENT": {
        "business_dashboard.view",
        "reports.view",
        "sales_summary.view",
        "marketing_summary.view",
        "support_summary.view",
    },

    "ANALYST": {
        "business_data.view",
        "analytics.view",
        "reports.view",
        "dashboards.view",
    },

    "CUSTOMER": {
        "profile.own_view",
        "orders.own_view",
        "tickets.own_view",
        "interactions.own_view",
    },
}


class HasRolePermission(BasePermission):
    """
    Allows access only when the authenticated user's role
    has the required application permission.
    """

    required_permission = None

    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False

        required_permission = getattr(
            view,
            "required_permission",
            self.required_permission
        )

        if not required_permission:
            return False

        role = getattr(request.user, "role", None)

        if not role:
            return False

        role_permissions = ROLE_PERMISSIONS.get(role, set())

        return required_permission in role_permissions