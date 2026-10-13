from django.urls import path

from rest_framework_simplejwt.views import TokenRefreshView

from .views import (
    RegisterView,
    MeView,
    OrganizationCreateView,
    StorefrontCustomerRegisterView,
    AuditedTokenObtainPairView,
)

urlpatterns = [
    path("storefront-register/", StorefrontCustomerRegisterView.as_view(), name="storefront-customer-register"),
    path("register/", RegisterView.as_view(), name="register"),

    path(
        "login/",
        AuditedTokenObtainPairView.as_view(),
        name="token_obtain_pair"
    ),

    path(
        "refresh/",
        TokenRefreshView.as_view(),
        name="token_refresh"
    ),

    path(
        "me/",
        MeView.as_view(),
        name="me"
    ),

    path(
        "organizations/",
        OrganizationCreateView.as_view(),
        name="organization_create"
    ),
]