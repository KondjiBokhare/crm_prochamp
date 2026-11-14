from django.urls import path

from .views import (
    MeView,
    OrganizationCreateView,
    RegisterView,
    RoleAccessView,
    StaffUserDetailView,
    StaffUserListCreateView,
    custom_login,
    custom_logout,
    custom_refresh,
    resend_verification_email,
    verify_email,
)

urlpatterns = [
    path("register/", RegisterView.as_view(), name="register"),
    path("login/", custom_login, name="custom-login"),
    path("refresh/", custom_refresh, name="custom-refresh"),
    path("logout/", custom_logout, name="custom-logout"),
    path("verify-email/", verify_email, name="verify-email"),
    path("resend-verification/", resend_verification_email, name="resend-verification"),
    path("me/", MeView.as_view(), name="me"),
    path("role-access/", RoleAccessView.as_view(), name="role-access"),

    # Superadmin-only tenant and organization-admin management.
    path("staff/", StaffUserListCreateView.as_view(), name="staff-list-create"),
    path("staff/<int:pk>/", StaffUserDetailView.as_view(), name="staff-detail"),
    path("organizations/", OrganizationCreateView.as_view(), name="organization-list-create"),
]
