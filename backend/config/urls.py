from django.contrib import admin
from django.urls import include, path
from crm.urls import storefront_account_urlpatterns, storefront_public_urlpatterns

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path(
        "api/storefront/account/",
        include((storefront_account_urlpatterns, "storefront-account")),
    ),
    path(
        "api/storefront/",
        include((storefront_public_urlpatterns, "storefront-public")),
    ),
    path("api/crm/", include("crm.urls")),
]
