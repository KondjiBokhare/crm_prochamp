from django.contrib import admin
from django.urls import include, path

urlpatterns = [
    path("admin/", admin.site.urls),
    path("api/auth/", include("accounts.urls")),
    path("api/storefront/account/", include("crm.storefront_account_urls")),
    path("api/crm/", include("crm.urls")),
    
]
