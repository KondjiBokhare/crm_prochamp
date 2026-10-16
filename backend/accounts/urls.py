from django.urls import path

from .views import (
    AuditedTokenObtainPairView,
    MeView,
    OrganizationCreateView,
    RegisterView,
    StaffUserDetailView,
    StaffUserListCreateView,
    custom_login,
    custom_logout,
    custom_refresh,
)

urlpatterns = [
    # Public registration
    path("register/", RegisterView.as_view(), name="register"),

    # Authentication: choose the login system already used by React.
    path("login/", custom_login, name="custom-login"),
    path("refresh/", custom_refresh, name="custom-refresh"),
    path("logout/", custom_logout, name="custom-logout"),

    # Optional Simple JWT login; keep only if your project uses it.
    path(
        "jwt/login/",
        AuditedTokenObtainPairView.as_view(),
        name="jwt-login",
    ),

    # Authenticated profile
    path("me/", MeView.as_view(), name="me"),

    # Admin-only management
    path(
        "staff/",
        StaffUserListCreateView.as_view(),
        name="staff-list-create",
    ),
    path(
        "staff/<int:pk>/",
        StaffUserDetailView.as_view(),
        name="staff-detail",
    ),
    path(
        "organizations/",
        OrganizationCreateView.as_view(),
        name="organization-create",
    ),
]